// src/routes/activityLogs.js
import express from "express";
import { activityLogService } from "../services/activityLogService.js";
import { dbHelpers } from "../config/database.js";

const router = express.Router();

/**
 * POST /api/activity-logs — log manual (frontend)
 */
router.post("/", async (req, res) => {
  try {
    const { action, table_name, record_id, description } = req.body;
    const user_id = req.user?.id || null;

    await activityLogService.logActivity({
      user_id,
      action,
      table_name,
      record_id,
      old_values: null,
      new_values: null,
      ip_address: activityLogService.getClientIp(req),
      user_agent: activityLogService.getUserAgent(req),
      description,
    });

    res.json({ success: true, message: "Activity logged successfully" });
  } catch (error) {
    console.error("❌ Error logging frontend activity:", error);
    res.status(500).json({ error: "Failed to log activity" });
  }
});

/**
 * GET /api/activity-logs — FULL FILTER SUPPORT, returns { data, pagination }
 */
router.get("/", async (req, res) => {
  try {
    const p = parseInt(req.query.page);
    const l = parseInt(req.query.limit);

    const page = Number.isFinite(p) && p > 0 ? p : 1;
    const limit = Number.isFinite(l) && l > 0 ? l : 50;
    const offset = (page - 1) * limit;

    console.log("=== ACTIVITY LOGS REQUEST ===");
    console.log("Page:", page, "Limit:", limit, "Offset:", offset);
    console.log("Query params:", req.query);

    // Build WHERE clause
    const whereConditions = [];
    const whereParams = [];

    if (req.query.action?.trim()) {
      whereConditions.push("al.action = ?");
      whereParams.push(req.query.action.trim());
    }

    if (req.query.table_name?.trim()) {
      whereConditions.push("al.table_name = ?");
      whereParams.push(req.query.table_name.trim());
    }

    if (req.query.user && !isNaN(Number(req.query.user))) {
      whereConditions.push("al.user_id = ?");
      whereParams.push(Number(req.query.user));
    }

    if (req.query.q?.trim()) {
      whereConditions.push("al.description LIKE ?");
      whereParams.push(`%${req.query.q.trim()}%`);
    }

    if (req.query.date_from) {
      whereConditions.push("al.created_at >= ?");
      whereParams.push(req.query.date_from + " 00:00:00");
    }

    if (req.query.date_to) {
      whereConditions.push("al.created_at <= ?");
      whereParams.push(req.query.date_to + " 23:59:59");
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    console.log("Where clause:", whereClause);
    console.log("Where params:", whereParams);

    // ---- COUNT QUERY ----
    const countSql = `
      SELECT COUNT(*) AS total
      FROM activity_logs al
      ${whereClause}
    `;

    console.log("Count SQL:", countSql);
    const countRows = await dbHelpers.query(countSql, whereParams);
    const total = countRows[0]?.total ?? 0;

    // ---- DATA QUERY ----
    // FIX: Gunakan string interpolation untuk LIMIT/OFFSET karena sudah divalidasi sebagai integer
    const dataSql = `
      SELECT al.*, u.username, u.full_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    console.log("Data SQL:", dataSql);
    console.log("Data params (WHERE only):", whereParams);

    // Hanya kirim whereParams (tanpa limit/offset karena sudah di-interpolate)
    const logs = await dbHelpers.query(dataSql, whereParams);

    console.log("Query successful. Found:", logs.length, "logs");

    return res.json({
      data: logs,
      pagination: { page, limit, total },
    });
  } catch (err) {
    console.error("❌ SQL ERROR in activityLogs route:", err);
    console.error("Error details:", {
      message: err.message,
      code: err.code,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage,
    });
    return res.status(500).json({ error: "Failed to fetch activity logs" });
  }
});

export default router;
