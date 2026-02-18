import { dbHelpers } from "../config/database.js";
import { emitDataChange } from "../utils/socketHelpers.js";
import { batchSyncEmployeeShifts } from "./employeeController.js";

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
        // value format: "field|match_type|keyword" OR "field|keyword" (backward compat)
        for (const val of rawIds) {
          const parts = val.split("|");
          const fieldVal = parts[0];
          const matchType = parts.length === 3 ? parts[1] : "LIKE";
          const keyword = parts.length === 3 ? parts[2] : parts[1];

          if (!fieldVal || !keyword) continue;

          // Validate matchType to prevent SQL injection
          const operator = matchType === "NOT LIKE" ? "NOT LIKE" : "LIKE";

          let query = "";
          let params = [`%${keyword}%`];

          if (fieldVal === "position_name") {
            query = `SELECT e.id FROM employees e JOIN positions p ON e.position_id = p.id WHERE p.position_name ${operator} ? AND e.deleted_at IS NULL`;
          } else if (fieldVal === "dept_name") {
            query = `SELECT e.id FROM employees e JOIN departments d ON e.department_id = d.id WHERE d.dept_name ${operator} ? AND e.deleted_at IS NULL`;
          } else if (fieldVal === "full_name") {
            query = `SELECT id FROM employees WHERE full_name ${operator} ? AND deleted_at IS NULL`;
          } else if (fieldVal === "nik") {
            query = `SELECT id FROM employees WHERE nik ${operator} ? AND deleted_at IS NULL`;
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
      if (["department_id", "employee_shift_id"].includes(field)) {
        // Multi-value fields: join into CSV
        processedValue = value.join(",");
      } else {
        // Single-value fields: take the first
        processedValue = value.length > 0 ? value[0] : null;
      }
    }

    // Special logic for Shift Rules vs Setting Rules
    if (field === "employee_shift_id") {
      const { rule_type } = req.body;
      if (rule_type === "setting") {
        processedValue = "setting"; // Marker for global settings in employees table cache
      }
    }

    const updateVal =
      processedValue === "" ||
      processedValue === null ||
      processedValue === "null" ||
      processedValue === "global"
        ? null
        : processedValue;

    let finalIdsForSync = [];
    if (isAll) {
      const [result] = await connection.query(
        `UPDATE employees SET ${field} = ? WHERE deleted_at IS NULL`,
        [updateVal],
      );
      affectedRows = result.affectedRows;

      // Get all IDs for sync
      const [allRows] = await connection.query(
        "SELECT id FROM employees WHERE deleted_at IS NULL",
      );
      finalIdsForSync = allRows.map((r) => r.id);
    } else if (finalEmployeeIds.size > 0) {
      const idsArray = Array.from(finalEmployeeIds);
      finalIdsForSync = idsArray;
      const [result] = await connection.query(
        `UPDATE employees SET ${field} = ? WHERE id IN (${idsArray.map(() => "?").join(",")})`,
        [updateVal, ...idsArray],
      );
      affectedRows = result.affectedRows;
    }

    await connection.commit();

    // After commit, sync shifts if it was the shift field
    if (field === "employee_shift_id" && finalIdsForSync.length > 0) {
      // processedValue here conveys the target CSV or "setting"
      await batchSyncEmployeeShifts(finalIdsForSync, processedValue);
    }

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
