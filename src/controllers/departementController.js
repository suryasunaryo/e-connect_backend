// controllers/departementController.js
import { dbHelpers } from "../config/database.js";
import { emitDataChange } from "../utils/socketHelpers.js";

/**
 * GET ALL DEPARTEMENTS
 */
export const getAllDepartements = async (req, res) => {
  try {
    const departements = await dbHelpers.query(`
      SELECT *, department_id as id FROM departments_view  
      ORDER BY dept_name ASC
    `);
    res.json(departements);
  } catch (error) {
    console.error("❌ Error fetching departments:", error);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
};

/**
 * GET DEPARTEMENT BY ID
 */
export const getDepartementById = async (req, res) => {
  try {
    const { id } = req.params;
    const departement = await dbHelpers.queryOne(
      `
      SELECT * FROM departments_view 
      WHERE id = ? 
    `,
      [id],
    );

    if (!departement) {
      return res.status(404).json({ error: "Department not found" });
    }

    res.json(departement);
  } catch (error) {
    console.error("❌ Error fetching department:", error);
    res.status(500).json({ error: "Failed to fetch department" });
  }
};

/**
 * CREATE DEPARTEMENT
 */
export const createDepartement = async (req, res) => {
  try {
    const { branch_id, dept_name, dept_code, parent_id, location } = req.body;

    // Validasi input berdasarkan struktur database
    if (!branch_id || !dept_name || !dept_code) {
      return res.status(400).json({
        error: "branch_id, dept_name, and dept_code are required",
      });
    }

    // Check if dept_code already exists
    const existing = await dbHelpers.queryOne(
      "SELECT id FROM departments WHERE dept_code = ? AND deleted_at IS NULL",
      [dept_code],
    );

    if (existing) {
      return res.status(400).json({
        error: "Department code already exists",
      });
    }

    const result = await dbHelpers.execute(
      `INSERT INTO departments (branch_id, dept_name, dept_code, parent_id, location) 
       VALUES (?, ?, ?, ?, ?)`,
      [branch_id, dept_name, dept_code, parent_id || null, location || null],
    );

    const newDepartement = await dbHelpers.queryOne(
      "SELECT * FROM departments WHERE id = ?",
      [result.insertId],
    );

    // Emit socket
    emitDataChange("departments", "create", newDepartement);

    res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: newDepartement,
    });
  } catch (error) {
    console.error("❌ Error creating department:", error);
    res.status(500).json({ error: "Failed to create department" });
  }
};

/**
 * UPDATE DEPARTEMENT
 */
export const updateDepartement = async (req, res) => {
  try {
    const { id } = req.params;
    const { branch_id, dept_name, dept_code, parent_id, location } = req.body;

    // Check if department exists
    const existing = await dbHelpers.queryOne(
      "SELECT * FROM departments WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!existing) {
      return res.status(404).json({ error: "Department not found" });
    }

    // Check if dept_code already exists (excluding current department)
    if (dept_code && dept_code !== existing.dept_code) {
      const codeExists = await dbHelpers.queryOne(
        "SELECT id FROM departments WHERE dept_code = ? AND id != ? AND deleted_at IS NULL",
        [dept_code, id],
      );

      if (codeExists) {
        return res.status(400).json({
          error: "Department code already exists",
        });
      }
    }

    // Update department berdasarkan struktur database
    await dbHelpers.execute(
      `UPDATE departments 
       SET branch_id = ?, dept_name = ?, dept_code = ?, parent_id = ?, location = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [
        branch_id || existing.branch_id,
        dept_name || existing.dept_name,
        dept_code || existing.dept_code,
        parent_id === undefined ? existing.parent_id : parent_id || null,
        location === undefined ? existing.location : location || null,
        id,
      ],
    );

    const updatedDepartement = await dbHelpers.queryOne(
      "SELECT * FROM departments WHERE id = ?",
      [id],
    );

    // Emit socket
    emitDataChange("departments", "update", updatedDepartement);

    res.json({
      success: true,
      message: "Department updated successfully",
      data: updatedDepartement,
    });
  } catch (error) {
    console.error("❌ Error updating department:", error);
    res.status(500).json({ error: "Failed to update department" });
  }
};

/**
 * DELETE DEPARTEMENT (SOFT DELETE)
 */
export const deleteDepartement = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if department exists
    const existing = await dbHelpers.queryOne(
      "SELECT * FROM departments WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!existing) {
      return res.status(404).json({ error: "Department not found" });
    }

    // Soft delete menggunakan deleted_at
    await dbHelpers.execute(
      "UPDATE departments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id],
    );

    // Emit socket
    emitDataChange("departments", "delete", { id });

    res.json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting department:", error);
    res.status(500).json({ error: "Failed to delete department" });
  }
};

/**
 * GET DEPARTMENT TREE
 * Fetches all branches and their nested departments recursively
 */
export const getDepartementTree = async (req, res) => {
  try {
    const branches = await dbHelpers.query(
      "SELECT id, branch_name FROM branches WHERE deleted_at IS NULL ORDER BY branch_name ASC",
    );

    const allDepartments = await dbHelpers.query(`
      SELECT d.*, b.branch_name 
      FROM departments d
      LEFT JOIN branches b ON d.branch_id = b.id
      WHERE d.deleted_at IS NULL
      ORDER BY d.location ASC, d.dept_name ASC
    `);

    const buildTree = (parentId, branchId) => {
      return allDepartments
        .filter((d) => d.parent_id === parentId && d.branch_id === branchId)
        .map((d) => ({
          ...d,
          children: buildTree(d.id, branchId),
        }));
    };

    const tree = branches.map((branch) => ({
      id: `branch-${branch.id}`,
      name: branch.branch_name,
      isBranch: true,
      branch_id: branch.id,
      children: buildTree(null, branch.id),
    }));

    res.json(tree);
  } catch (error) {
    console.error("❌ Error fetching department tree:", error);
    res.status(500).json({ error: "Failed to fetch department tree" });
  }
};

/**
 * MOVE DEPARTMENT (DRAG & DROP)
 */
export const moveDepartement = async (req, res) => {
  try {
    const { id, parent_id, new_location, branch_id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Department ID is required" });
    }

    // 1. Fetch current moved item to check its branch
    const movedItem = await dbHelpers.queryOne(
      "SELECT branch_id FROM departments WHERE id = ?",
      [id],
    );

    if (!movedItem) {
      return res.status(404).json({ error: "Department not found" });
    }

    // Prevent cross-branch moves
    if (branch_id && movedItem.branch_id != branch_id) {
      return res
        .status(400)
        .json({ error: "Cannot move department to a different branch" });
    }

    // 2. Update the moved department first (Primary Update)
    await dbHelpers.execute(
      "UPDATE departments SET parent_id = ?, location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [parent_id || null, new_location, id],
    );

    // 3. Sync/Reorder siblings
    // Fetch all siblings of the *new* parent (including the moved item itself)
    // Ordered by location ASC
    const siblings = await dbHelpers.query(
      "SELECT id, location FROM departments WHERE parent_id <=> ? AND branch_id = ? AND deleted_at IS NULL ORDER BY location ASC, updated_at DESC",
      [parent_id || null, movedItem.branch_id],
    );

    let counter = 1;
    const targetLocation = parseInt(new_location);

    for (const sibling of siblings) {
      if (sibling.id === parseInt(id)) {
        // The moved item is already at targetLocation
      } else {
        if (counter === targetLocation) {
          counter++;
        }
        await dbHelpers.execute(
          "UPDATE departments SET location = ? WHERE id = ?",
          [counter, sibling.id],
        );
        counter++;
      }
    }

    res.json({ message: "Department moved and reordered successfully" });
  } catch (error) {
    console.error("❌ Error moving department:", error);
    res.status(500).json({ error: "Failed to move department" });
  }
};
