// controllers/positionsController.js
import { dbHelpers } from "../config/database.js";

/**
 * GET ALL POSITIONS
 */
export const getAllPositions = async (req, res) => {
  try {
    const positions = await dbHelpers.query(`
      SELECT 
        p.*,
        b.branch_name,
        parent.position_name as parent_position_name
      FROM positions p
      LEFT JOIN branches b ON p.branch_id = b.id
      LEFT JOIN positions parent ON p.parent_id = parent.id
      WHERE p.deleted_at IS NULL 
      ORDER BY p.position_name ASC
    `);
    res.json(positions);
  } catch (error) {
    console.error("❌ Error fetching positions:", error);
    res.status(500).json({ error: "Failed to fetch positions" });
  }
};

/**
 * GET POSITIONS BY BRANCH
 */
export const getPositionsByBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const positions = await dbHelpers.query(
      `
      SELECT 
        p.id,
        p.position_name as name
      FROM positions p
      WHERE p.branch_id = ? AND p.deleted_at IS NULL 
      ORDER BY p.position_name ASC
    `,
      [branchId],
    );
    res.json(positions);
  } catch (error) {
    console.error("❌ Error fetching positions by branch:", error);
    res.status(500).json({ error: "Failed to fetch positions" });
  }
};

/**
 * CREATE POSITION
 */
export const createPosition = async (req, res) => {
  try {
    const { branch_id, position_name, parent_id, location } = req.body;

    if (!branch_id || !position_name) {
      return res
        .status(400)
        .json({ error: "Branch ID and Position Name are required" });
    }

    const result = await dbHelpers.execute(
      "INSERT INTO positions (branch_id, position_name, parent_id, location) VALUES (?, ?, ?, ?)",
      [branch_id, position_name, parent_id || null, location || null],
    );

    const newPosition = await dbHelpers.queryOne(
      "SELECT * FROM positions WHERE id = ?",
      [result.insertId],
    );

    res.status(201).json(newPosition);
  } catch (error) {
    console.error("❌ Error creating position:", error);
    res.status(500).json({ error: "Failed to create position" });
  }
};

/**
 * UPDATE POSITION
 */
export const updatePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { branch_id, position_name, parent_id, location } = req.body;

    const existing = await dbHelpers.queryOne(
      "SELECT id FROM positions WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!existing) {
      return res.status(404).json({ error: "Position not found" });
    }

    await dbHelpers.execute(
      "UPDATE positions SET branch_id = ?, position_name = ?, parent_id = ?, location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [branch_id, position_name, parent_id || null, location || null, id],
    );

    const updatedPosition = await dbHelpers.queryOne(
      "SELECT * FROM positions WHERE id = ?",
      [id],
    );

    res.json(updatedPosition);
  } catch (error) {
    console.error("❌ Error updating position:", error);
    res.status(500).json({ error: "Failed to update position" });
  }
};

/**
 * DELETE POSITION (SOFT DELETE)
 */
export const deletePosition = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await dbHelpers.queryOne(
      "SELECT id FROM positions WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!existing) {
      return res.status(404).json({ error: "Position not found" });
    }

    await dbHelpers.execute(
      "UPDATE positions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id],
    );

    res.json({ message: "Position deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting position:", error);
    res.status(500).json({ error: "Failed to delete position" });
  }
};

/**
 * GET POSITION TREE
 * Fetches all branches and their nested positions recursively
 */
export const getPositionTree = async (req, res) => {
  try {
    const branches = await dbHelpers.query(
      "SELECT id, branch_name FROM branches WHERE deleted_at IS NULL ORDER BY branch_name ASC",
    );

    const allPositions = await dbHelpers.query(`
      SELECT p.*, b.branch_name 
      FROM positions p
      LEFT JOIN branches b ON p.branch_id = b.id
      WHERE p.deleted_at IS NULL
      ORDER BY p.location ASC, p.position_name ASC
    `);

    const buildTree = (parentId, branchId) => {
      return allPositions
        .filter((p) => p.parent_id === parentId && p.branch_id === branchId)
        .map((p) => ({
          ...p,
          children: buildTree(p.id, branchId),
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
    console.error("❌ Error fetching position tree:", error);
    res.status(500).json({ error: "Failed to fetch position tree" });
  }
};

/**
 * MOVE POSITION (DRAG & DROP)
 */
/**
 * MOVE POSITION (DRAG & DROP)
 */
export const movePosition = async (req, res) => {
  try {
    const { id, parent_id, new_location, branch_id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Position ID is required" });
    }

    // 1. Fetch current moved item to check its branch
    const movedItem = await dbHelpers.queryOne(
      "SELECT branch_id FROM positions WHERE id = ?",
      [id],
    );

    if (!movedItem) {
      return res.status(404).json({ error: "Position not found" });
    }

    // Prevent cross-branch moves
    if (branch_id && movedItem.branch_id != branch_id) {
      return res
        .status(400)
        .json({ error: "Cannot move position to a different branch" });
    }

    // 2. Update the moved position first (Primary Update)
    await dbHelpers.execute(
      "UPDATE positions SET parent_id = ?, location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [parent_id || null, new_location, id],
    );

    // 3. Sync/Reorder siblings (Auto-Normalization logic from cipta_apps_prod)
    // Fetch all siblings of the *new* parent (including the moved item itself)
    // Ordered by location ASC
    const siblings = await dbHelpers.query(
      "SELECT id, location FROM positions WHERE parent_id <=> ? AND branch_id = ? AND deleted_at IS NULL ORDER BY location ASC, updated_at DESC",
      [parent_id || null, movedItem.branch_id],
    );

    let counter = 1;
    const targetLocation = parseInt(new_location);

    for (const sibling of siblings) {
      if (sibling.id === parseInt(id)) {
        // The moved item is already at targetLocation (we updated it above).
        // We skip re-updating it to avoid redundancy, but logically it holds the 'targetLocation' slot.
      } else {
        // For other items, we assign sequential locations.
        // If the current sequence counter hits the targetLocation (occupied by moved item),
        // we increment the counter to 'skip' that slot.
        if (counter === targetLocation) {
          counter++;
        }

        // Update sibling location
        await dbHelpers.execute(
          "UPDATE positions SET location = ? WHERE id = ?",
          [counter, sibling.id],
        );

        counter++;
      }
    }

    res.json({ message: "Position moved and reordered successfully" });
  } catch (error) {
    console.error("❌ Error moving position:", error);
    res.status(500).json({ error: "Failed to move position" });
  }
};
