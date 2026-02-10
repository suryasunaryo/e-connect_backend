import { getPool } from "../config/database.js";
import { activityLogService } from "../services/activityLogService.js";
import { emitDataChange } from "../utils/socketHelpers.js";

// Helper to log activity
const logActivity = async (
  req,
  action,
  tableName,
  recordId,
  description,
  oldValues = null,
  newValues = null,
) => {
  try {
    await activityLogService.logActivity({
      user_id: req.user?.id,
      action,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: activityLogService.getClientIp(req),
      user_agent: activityLogService.getUserAgent(req),
      description,
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};

// =======================================================
// 1. ATTENDANCE CODE
// =======================================================
export const getAttendanceCodes = async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT * FROM attendance_code WHERE is_deleted IS NULL OR is_deleted = 0",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createAttendanceCode = async (req, res) => {
  try {
    const { code_id, code, detail } = req.body;
    const pool = getPool();
    const [result] = await pool.query(
      "INSERT INTO attendance_code (code_id, code, detail) VALUES (?, ?, ?)",
      [code_id, code, detail],
    );

    await logActivity(
      req,
      "CREATE",
      "attendance_code",
      result.insertId,
      `Created attendance code: ${code}`,
      null,
      req.body,
    );

    res.status(201).json({ id: result.insertId, code_id, code, detail });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAttendanceCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { code_id, code, detail } = req.body;
    const pool = getPool();

    // Get old values
    const [oldRows] = await pool.query(
      "SELECT * FROM attendance_code WHERE id = ?",
      [id],
    );
    const oldValues = oldRows[0];

    await pool.query(
      "UPDATE attendance_code SET code_id = ?, code = ?, detail = ? WHERE id = ?",
      [code_id, code, detail, id],
    );

    await logActivity(
      req,
      "UPDATE",
      "attendance_code",
      id,
      `Updated attendance code: ${code}`,
      oldValues,
      req.body,
    );

    res.json({ message: "Attendance code updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAttendanceCode = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [oldRows] = await pool.query(
      "SELECT * FROM attendance_code WHERE id = ?",
      [id],
    );
    const oldValues = oldRows[0];

    // Soft delete
    await pool.query(
      "UPDATE attendance_code SET is_deleted = 1, deleted_at = NOW() WHERE id = ?",
      [id],
    );

    await logActivity(
      req,
      "DELETE",
      "attendance_code",
      id,
      `Deleted attendance code ID: ${id}`,
      oldValues,
      null,
    );

    res.json({ message: "Attendance code deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// =======================================================
// 2. ATTENDANCE EMPLOYEE SHIFT
// =======================================================
export const getEmployeeShifts = async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT aes.*, e.full_name, s.shift_name 
      FROM attendance_employee_shift aes
      LEFT JOIN employees e ON aes.target_type = 'user' AND (aes.target_value = e.id OR aes.target_value = e.nik)
      LEFT JOIN attendance_shifts s ON aes.shift_id = s.shift_id
      WHERE aes.is_deleted IS NULL OR aes.is_deleted = 0
    `);
    res.json(rows);
  } catch (error) {
    console.error("❌ Error in getEmployeeShifts:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: error.message });
  }
};

export const createEmployeeShift = async (req, res) => {
  try {
    console.log("📝 Creating employee shift with data:", req.body);
    const {
      target_type,
      target_value,
      rule_type,
      shift_id,
      start_date,
      end_date,
    } = req.body;

    // Validate required fields
    // Note: target_value can be empty when target_type is 'all'
    if (!target_type || !rule_type || !start_date) {
      console.error("❌ Missing required fields");
      return res.status(400).json({
        error: "Missing required fields: target_type, rule_type, start_date",
      });
    }

    // Validate target_value is provided for non-'all' types
    if (target_type !== "all" && !target_value) {
      console.error(
        "❌ target_value is required when target_type is not 'all'",
      );
      return res.status(400).json({
        error: "target_value is required when target_type is not 'all'",
      });
    }

    const pool = getPool();
    const [result] = await pool.query(
      "INSERT INTO attendance_employee_shift (target_type, target_value, rule_type, shift_id, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)",
      [
        target_type || "user",
        target_type === "all" ? "all" : target_value, // Use 'all' as value when type is 'all'
        rule_type || "shift",
        shift_id || null,
        start_date,
        end_date || null,
      ],
    );

    console.log("✅ Employee shift created successfully, ID:", result.insertId);

    await logActivity(
      req,
      "CREATE",
      "attendance_employee_shift",
      result.insertId,
      `Assigned ${rule_type} ${shift_id || ""} to ${target_type}: ${target_value}`,
      null,
      req.body,
    );

    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (error) {
    console.error("❌ Error in createEmployeeShift:", error);
    console.error("Error stack:", error.stack);
    console.error("Request body:", req.body);
    res.status(500).json({ error: error.message });
  }
};

export const updateEmployeeShift = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      target_type,
      target_value,
      rule_type,
      shift_id,
      start_date,
      end_date,
    } = req.body;
    const pool = getPool();

    const [oldRows] = await pool.query(
      "SELECT * FROM attendance_employee_shift WHERE id = ?",
      [id],
    );
    const oldValues = oldRows[0];

    await pool.query(
      "UPDATE attendance_employee_shift SET target_type = ?, target_value = ?, rule_type = ?, shift_id = ?, start_date = ?, end_date = ? WHERE id = ?",
      [
        target_type || "user",
        target_type === "all" ? "all" : target_value, // Use 'all' as value when type is 'all'
        rule_type || "shift",
        shift_id || null,
        start_date,
        end_date || null,
        id,
      ],
    );

    await logActivity(
      req,
      "UPDATE",
      "attendance_employee_shift",
      id,
      `Updated employee shift ID: ${id}`,
      oldValues,
      req.body,
    );

    res.json({ message: "Employee shift updated successfully" });
  } catch (error) {
    console.error("❌ Error in updateEmployeeShift:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: error.message });
  }
};

export const deleteEmployeeShift = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [oldRows] = await pool.query(
      "SELECT * FROM attendance_employee_shift WHERE id = ?",
      [id],
    );
    const oldValues = oldRows[0];

    await pool.query(
      "UPDATE attendance_employee_shift SET is_deleted = 1, deleted_at = NOW() WHERE id = ?",
      [id],
    );

    await logActivity(
      req,
      "DELETE",
      "attendance_employee_shift",
      id,
      `Deleted employee shift ID: ${id}`,
      oldValues,
      null,
    );

    res.json({ message: "Employee shift deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// =======================================================
// 3. ATTENDANCE SETTINGS
// =======================================================
export const getAttendanceSettings = async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT * FROM attendance_settings WHERE is_deleted IS NULL OR is_deleted = 0",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createAttendanceSetting = async (req, res) => {
  try {
    const { setting_key, setting_value, description } = req.body;
    const pool = getPool();
    const [result] = await pool.query(
      "INSERT INTO attendance_settings (setting_key, setting_value, description) VALUES (?, ?, ?)",
      [setting_key, setting_value, description],
    );

    await logActivity(
      req,
      "CREATE",
      "attendance_settings",
      result.insertId,
      `Created setting: ${setting_key}`,
      null,
      req.body,
    );

    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAttendanceSetting = async (req, res) => {
  try {
    const { id } = req.params;
    const { setting_key, setting_value, description } = req.body;
    const pool = getPool();

    const [oldRows] = await pool.query(
      "SELECT * FROM attendance_settings WHERE id = ?",
      [id],
    );
    const oldValues = oldRows[0];

    await pool.query(
      "UPDATE attendance_settings SET setting_key = ?, setting_value = ?, description = ? WHERE id = ?",
      [setting_key, setting_value, description, id],
    );

    await logActivity(
      req,
      "UPDATE",
      "attendance_settings",
      id,
      `Updated setting: ${setting_key}`,
      oldValues,
      req.body,
    );

    res.json({ message: "Attendance setting updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAttendanceSetting = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [oldRows] = await pool.query(
      "SELECT * FROM attendance_settings WHERE id = ?",
      [id],
    );
    const oldValues = oldRows[0];

    await pool.query(
      "UPDATE attendance_settings SET is_deleted = 1, deleted_at = NOW() WHERE id = ?",
      [id],
    );

    await logActivity(
      req,
      "DELETE",
      "attendance_settings",
      id,
      `Deleted setting ID: ${id}`,
      oldValues,
      null,
    );

    res.json({ message: "Attendance setting deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// =======================================================
// 4. ATTENDANCE SHIFTS
// =======================================================
export const getShifts = async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT * FROM attendance_shifts WHERE is_deleted IS NULL OR is_deleted = 0",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createShift = async (req, res) => {
  try {
    const {
      shift_code,
      shift_name,
      start_time,
      end_time,
      break_start,
      break_end,
      work_days,
      breaks,
    } = req.body;
    const pool = getPool();
    const [result] = await pool.query(
      "INSERT INTO attendance_shifts (shift_code, shift_name, start_time, end_time, break_start, break_end, work_days, breaks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        shift_code,
        shift_name,
        start_time,
        end_time,
        break_start,
        break_end,
        JSON.stringify(work_days || []),
        JSON.stringify(breaks || []),
      ],
    );

    await logActivity(
      req,
      "CREATE",
      "attendance_shifts",
      result.insertId,
      `Created shift: ${shift_name}`,
      null,
      req.body,
    );

    res.status(201).json({ shift_id: result.insertId, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      shift_code,
      shift_name,
      start_time,
      end_time,
      break_start,
      break_end,
      work_days,
      breaks,
    } = req.body;
    const pool = getPool();

    const [oldRows] = await pool.query(
      "SELECT * FROM attendance_shifts WHERE shift_id = ?",
      [id],
    );
    const oldValues = oldRows[0];

    await pool.query(
      "UPDATE attendance_shifts SET shift_code = ?, shift_name = ?, start_time = ?, end_time = ?, break_start = ?, break_end = ?, work_days = ?, breaks = ? WHERE shift_id = ?",
      [
        shift_code,
        shift_name,
        start_time,
        end_time,
        break_start,
        break_end,
        JSON.stringify(work_days || []),
        JSON.stringify(breaks || []),
        id,
      ],
    );

    await logActivity(
      req,
      "UPDATE",
      "attendance_shifts",
      id,
      `Updated shift: ${shift_name}`,
      oldValues,
      req.body,
    );

    res.json({ message: "Shift updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [oldRows] = await pool.query(
      "SELECT * FROM attendance_shifts WHERE shift_id = ?",
      [id],
    );
    const oldValues = oldRows[0];

    await pool.query(
      "UPDATE attendance_shifts SET is_deleted = 1, deleted_at = NOW() WHERE shift_id = ?",
      [id],
    );

    await logActivity(
      req,
      "DELETE",
      "attendance_shifts",
      id,
      `Deleted shift ID: ${id}`,
      oldValues,
      null,
    );

    res.json({ message: "Shift deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// =======================================================
// 5. ATTENDANCE SHIFT RULES
// =======================================================
export const getShiftRules = async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT asr.*, s.shift_name, s.shift_code
      FROM attendance_shift_rules asr
      JOIN attendance_shifts s ON asr.shift_id = s.shift_id
      WHERE asr.is_deleted IS NULL OR asr.is_deleted = 0
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createShiftRule = async (req, res) => {
  try {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO attendance_shift_rules 
      (shift_id, late_tolerance_minutes, max_late_minutes, early_leave_tolerance_minutes, halfday_min_work_minutes, ot_start_after_minutes, max_ot_per_day, required_check_in, required_check_out, incomplete_checkclock_rule, grace_period_start, grace_period_end) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.body.shift_id,
        req.body.late_tolerance_minutes,
        req.body.max_late_minutes,
        req.body.early_leave_tolerance_minutes,
        req.body.halfday_min_work_minutes,
        req.body.ot_start_after_minutes,
        req.body.max_ot_per_day,
        req.body.required_check_in,
        req.body.required_check_out,
        req.body.incomplete_checkclock_rule,
        req.body.grace_period_start || null,
        req.body.grace_period_end || null,
      ],
    );

    await logActivity(
      req,
      "CREATE",
      "attendance_shift_rules",
      result.insertId,
      `Created shift rule for shift ID: ${req.body.shift_id}`,
      null,
      req.body,
    );

    res.status(201).json({ rule_id: result.insertId, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateShiftRule = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [oldRows] = await pool.query(
      "SELECT * FROM attendance_shift_rules WHERE rule_id = ?",
      [id],
    );
    const oldValues = oldRows[0];

    await pool.query(
      `UPDATE attendance_shift_rules SET 
      shift_id = ?, late_tolerance_minutes = ?, max_late_minutes = ?, early_leave_tolerance_minutes = ?, halfday_min_work_minutes = ?, ot_start_after_minutes = ?, max_ot_per_day = ?, required_check_in = ?, required_check_out = ?, incomplete_checkclock_rule = ?, grace_period_start = ?, grace_period_end = ?
      WHERE rule_id = ?`,
      [
        req.body.shift_id,
        req.body.late_tolerance_minutes,
        req.body.max_late_minutes,
        req.body.early_leave_tolerance_minutes,
        req.body.halfday_min_work_minutes,
        req.body.ot_start_after_minutes,
        req.body.max_ot_per_day,
        req.body.required_check_in,
        req.body.required_check_out,
        req.body.incomplete_checkclock_rule,
        req.body.grace_period_start || null,
        req.body.grace_period_end || null,
        id,
      ],
    );

    await logActivity(
      req,
      "UPDATE",
      "attendance_shift_rules",
      id,
      `Updated shift rule ID: ${id}`,
      oldValues,
      req.body,
    );

    res.json({ message: "Shift rule updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteShiftRule = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [oldRows] = await pool.query(
      "SELECT * FROM attendance_shift_rules WHERE rule_id = ?",
      [id],
    );
    const oldValues = oldRows[0];

    await pool.query(
      "UPDATE attendance_shift_rules SET is_deleted = 1, deleted_at = NOW() WHERE rule_id = ?",
      [id],
    );

    await logActivity(
      req,
      "DELETE",
      "attendance_shift_rules",
      id,
      `Deleted shift rule ID: ${id}`,
      oldValues,
      null,
    );

    res.json({ message: "Shift rule deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// =======================================================
// 6. ATTENDANCE CAPTURE
// =======================================================
export const uploadAttendanceCapture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { nik } = req.body;
    // Construct relative path based on the file destination
    // req.file.destination gives absolute path, we want relative for DB/response
    // e.g. /uploads/absensi/07022026/12345/absensi-12345-07022026.jpg

    // We can extract relative path starting from 'uploads'
    const relativePath = req.file.path.split("uploads")[1];
    const filePath = `/uploads${relativePath.replace(/\\/g, "/")}`; // Ensure forward slashes for URL

    // Optional: Log to activity or database if needed
    // Insert into attendance_log
    const pool = getPool();

    // Get employee details for the log
    // We assume NIK is unique and exists since they just scanned
    const [empRows] = await pool.query(
      "SELECT full_name, rfid_number FROM employees WHERE nik = ?",
      [nik],
    );
    const emp = empRows[0] || {};

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(" ")[0]; // HH:MM:SS

    const [result] = await pool.query(
      "INSERT INTO attendance_log (nik, full_name, rfid_number, picture, attendance_date, attendance_time) VALUES (?, ?, ?, ?, ?, ?)",
      [
        nik,
        emp.full_name || "Unknown",
        emp.rfid_number || "Unknown",
        filePath,
        dateStr,
        timeStr,
      ],
    );

    const newLog = {
      id: result.insertId,
      nik,
      full_name: emp.full_name || "Unknown",
      rfid_number: emp.rfid_number || "Unknown",
      picture: filePath,
      attendance_date: dateStr,
      attendance_time: timeStr,
      created_at: now.toISOString(),
    };

    // Emit socket event for real-time updates
    emitDataChange("attendance_logs", "create", newLog);

    console.log(`📸 Attendance capture received and logged for NIK: ${nik}`);

    res.json({
      success: true,
      message: "Attendance photo uploaded and logged successfully",
      file_path: filePath,
    });
  } catch (error) {
    console.error("Error uploading attendance capture:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getAttendanceLogs = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10, search = "" } = req.query;
    const offset = (page - 1) * limit;
    const pool = getPool();

    let query = "SELECT * FROM attendance_log";
    let countQuery = "SELECT COUNT(*) as total FROM attendance_log";
    let whereClauses = [];
    let params = [];

    if (startDate && endDate) {
      whereClauses.push("attendance_date BETWEEN ? AND ?");
      params.push(startDate, endDate);
    }

    if (search) {
      whereClauses.push(
        "(full_name LIKE ? OR nik LIKE ? OR rfid_number LIKE ?)",
      );
      const searchVal = `%${search}%`;
      params.push(searchVal, searchVal, searchVal);
    }

    const whereClause =
      whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : "";

    query += whereClause + " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    countQuery += whereClause;

    const [rows] = await pool.query(query, [
      ...params,
      parseInt(limit),
      parseInt(offset),
    ]);
    const [countRows] = await pool.query(countQuery, params);

    res.json({
      data: {
        logs: rows,
        total: countRows[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAttendanceLog = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.query("DELETE FROM attendance_log WHERE id = ?", [id]);

    // Note: We might want to delete the actual file too, but keeping it simple for now or strictly following instructions which didn't specify file deletion logic on log delete.

    res.json({ message: "Attendance log deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
