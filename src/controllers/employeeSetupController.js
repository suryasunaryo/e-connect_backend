import { dbHelpers } from "../config/database.js";
import { emitDataChange } from "../utils/socketHelpers.js";

/**
 * 🛠 GET OPTIONS FOR BATCH SETUP
 * GET /api/employee-batch-setup/options
 */
export const getBatchSetupOptions = async (req, res) => {
  try {
    const locations = await dbHelpers.query(
      "SELECT id, office_name FROM location WHERE deleted_at IS NULL ORDER BY office_name ASC",
    );
    const shifts = await dbHelpers.query(
      "SELECT shift_id, shift_name, shift_code FROM attendance_shifts ORDER BY shift_name ASC",
    );
    const departments = await dbHelpers.query(
      "SELECT id, dept_name FROM departments WHERE deleted_at IS NULL ORDER BY dept_name ASC",
    );
    const branches = await dbHelpers.query(
      "SELECT id, branch_name FROM branches WHERE deleted_at IS NULL ORDER BY branch_name ASC",
    );
    const positions = await dbHelpers.query(
      "SELECT id, position_name FROM positions WHERE deleted_at IS NULL ORDER BY position_name ASC",
    );
    const roles = await dbHelpers.query("SELECT id, role_name FROM users_role");
    const users = await dbHelpers.query(
      "SELECT id, full_name, username FROM users WHERE is_active = TRUE ORDER BY full_name ASC",
    );

    res.json({
      success: true,
      data: {
        locations,
        shifts,
        departments,
        branches,
        positions,
        roles,
        users,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching batch setup options:", error);
    res.status(500).json({ error: "Failed to fetch setup options" });
  }
};

/**
 * 🚀 BATCH UPDATE EMPLOYEES
 * POST /api/employee-batch-setup/update
 */
export const batchUpdateEmployees = async (req, res) => {
  const connection = await dbHelpers.getPool().getConnection();
  try {
    const { targets, field, value } = req.body;

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ error: "Targets are required" });
    }

    if (
      !field ||
      !["location_id", "employee_shift_id", "department_id"].includes(field)
    ) {
      return res.status(400).json({ error: "Invalid field for update" });
    }

    await connection.beginTransaction();

    // Helper to resolve employee IDs from target
    const resolveEmployeeIds = async (tType, tValue) => {
      if (!tType || tType === "all") {
        const rows = await connection.query(
          "SELECT id FROM employees WHERE deleted_at IS NULL",
        );
        return rows[0].map((r) => r.id);
      }
      if (!tValue) return [];

      const rawIds = tValue.split(",").map((v) => v.trim());
      if (rawIds.length === 0) return [];

      let ids = [];
      if (tType === "user") {
        const [rows] = await connection.query(
          `SELECT id FROM employees WHERE user_id IN (${rawIds.map(() => "?").join(",")}) AND deleted_at IS NULL`,
          rawIds,
        );
        ids = rows.map((r) => r.id);
      } else if (tType === "department") {
        const [rows] = await connection.query(
          `SELECT id FROM employees WHERE department_id IN (${rawIds.map(() => "?").join(",")}) AND deleted_at IS NULL`,
          rawIds,
        );
        ids = rows.map((r) => r.id);
      } else if (tType === "branch") {
        const [rows] = await connection.query(
          `SELECT id FROM employees WHERE branch_id IN (${rawIds.map(() => "?").join(",")}) AND deleted_at IS NULL`,
          rawIds,
        );
        ids = rows.map((r) => r.id);
      } else if (tType === "location") {
        const [rows] = await connection.query(
          `SELECT id FROM employees WHERE location_id IN (${rawIds.map(() => "?").join(",")}) AND deleted_at IS NULL`,
          rawIds,
        );
        ids = rows.map((r) => r.id);
      } else if (tType === "position") {
        const [rows] = await connection.query(
          `SELECT id FROM employees WHERE position_id IN (${rawIds.map(() => "?").join(",")}) AND deleted_at IS NULL`,
          rawIds,
        );
        ids = rows.map((r) => r.id);
      } else if (tType === "role") {
        const [rows] = await connection.query(
          `SELECT e.id FROM employees e JOIN users u ON e.user_id = u.id WHERE u.role_id IN (${rawIds.map(() => "?").join(",")}) AND e.deleted_at IS NULL`,
          rawIds,
        );
        ids = rows.map((r) => r.id);
      } else if (tType === "keyword") {
        // value format: "field|keyword"
        for (const val of rawIds) {
          const [fieldVal, keyword] = val.split("|");
          if (!fieldVal || !keyword) continue;

          let query = "";
          let params = [`%${keyword}%`];

          if (fieldVal === "position_name") {
            query = `SELECT e.id FROM employees e JOIN positions p ON e.position_id = p.id WHERE p.position_name LIKE ? AND e.deleted_at IS NULL`;
          } else if (fieldVal === "dept_name") {
            query = `SELECT e.id FROM employees e JOIN departments d ON e.department_id = d.id WHERE d.dept_name LIKE ? AND e.deleted_at IS NULL`;
          } else if (fieldVal === "full_name") {
            query = `SELECT id FROM employees WHERE full_name LIKE ? AND deleted_at IS NULL`;
          } else if (fieldVal === "nik") {
            query = `SELECT id FROM employees WHERE nik LIKE ? AND deleted_at IS NULL`;
          }

          if (query) {
            const [rows] = await connection.query(query, params);
            rows.forEach((r) => ids.push(r.id));
          }
        }
      }
      return ids;
    };

    let finalEmployeeIds = new Set();
    let isAll = false;

    for (const t of targets) {
      const ids = await resolveEmployeeIds(t.type, t.value);
      if (t.type === "all") {
        isAll = true;
        break;
      }
      ids.forEach((id) => finalEmployeeIds.add(id));
    }

    let affectedRows = 0;

    // Handle Value (supports array or string)
    let processedValue = value;
    if (Array.isArray(value)) {
      // For now, simple fields like department_id and employee_shift_id (FK) support only one value.
      // We take the first selected value.
      processedValue = value.length > 0 ? value[0] : null;
    }

    // Special logic for Shift Rules vs Setting Rules
    if (field === "employee_shift_id") {
      const { rule_type } = req.body;
      if (rule_type === "setting") {
        processedValue = null; // Set to NULL to use Global Setting
      }
      // If rule_type is shift, processedValue is already set to the selected shift_id
    }

    const updateVal =
      processedValue === "" ||
      processedValue === null ||
      processedValue === "null" ||
      processedValue === "global"
        ? null
        : processedValue;

    if (isAll) {
      const [result] = await connection.query(
        `UPDATE employees SET ${field} = ? WHERE deleted_at IS NULL`,
        [updateVal],
      );
      affectedRows = result.affectedRows;
    } else if (finalEmployeeIds.size > 0) {
      const idsArray = Array.from(finalEmployeeIds);
      const [result] = await connection.query(
        `UPDATE employees SET ${field} = ? WHERE id IN (${idsArray.map(() => "?").join(",")})`,
        [updateVal, ...idsArray],
      );
      affectedRows = result.affectedRows;
    }

    await connection.commit();

    emitDataChange("employees", "update", { field, count: affectedRows });

    res.json({
      success: true,
      message: `${affectedRows} employees updated successfully`,
      affectedRows,
    });
  } catch (error) {
    await connection.rollback();
    console.error("❌ Batch update employees error:", error);
    res.status(500).json({ error: "Failed to perform batch update" });
  } finally {
    connection.release();
  }
};
