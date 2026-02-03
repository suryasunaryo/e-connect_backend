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
      LEFT JOIN employees e ON aes.employee_id = e.id OR aes.employee_id = e.nik
      LEFT JOIN attendance_shifts s ON aes.shift_id = s.shift_id
      WHERE aes.is_deleted IS NULL OR aes.is_deleted = 0
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createEmployeeShift = async (req, res) => {
  try {
    const { employee_id, shift_id, start_date, end_date } = req.body;
    const pool = getPool();
    const [result] = await pool.query(
      "INSERT INTO attendance_employee_shift (employee_id, shift_id, start_date, end_date) VALUES (?, ?, ?, ?)",
      [employee_id, shift_id, start_date, end_date],
    );

    await logActivity(
      req,
      "CREATE",
      "attendance_employee_shift",
      result.insertId,
      `Assigned shift ${shift_id} to employee ${employee_id}`,
      null,
      req.body,
    );

    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateEmployeeShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { employee_id, shift_id, start_date, end_date } = req.body;
    const pool = getPool();

    const [oldRows] = await pool.query(
      "SELECT * FROM attendance_employee_shift WHERE id = ?",
      [id],
    );
    const oldValues = oldRows[0];

    await pool.query(
      "UPDATE attendance_employee_shift SET employee_id = ?, shift_id = ?, start_date = ?, end_date = ? WHERE id = ?",
      [employee_id, shift_id, start_date, end_date, id],
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
    } = req.body;
    const pool = getPool();
    const [result] = await pool.query(
      "INSERT INTO attendance_shifts (shift_code, shift_name, start_time, end_time, break_start, break_end) VALUES (?, ?, ?, ?, ?, ?)",
      [shift_code, shift_name, start_time, end_time, break_start, break_end],
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
    } = req.body;
    const pool = getPool();

    const [oldRows] = await pool.query(
      "SELECT * FROM attendance_shifts WHERE shift_id = ?",
      [id],
    );
    const oldValues = oldRows[0];

    await pool.query(
      "UPDATE attendance_shifts SET shift_code = ?, shift_name = ?, start_time = ?, end_time = ?, break_start = ?, break_end = ? WHERE shift_id = ?",
      [
        shift_code,
        shift_name,
        start_time,
        end_time,
        break_start,
        break_end,
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
      SELECT asr.*, s.shift_name 
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
        req.body.grace_period_start,
        req.body.grace_period_end,
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
        req.body.grace_period_start,
        req.body.grace_period_end,
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
