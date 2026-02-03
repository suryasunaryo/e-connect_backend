// services/activityLogService.js
import { dbHelpers } from "../config/database.js";

export const activityLogService = {
  /**
   * 🌟 Log activity ke database (support semua modul)
   * - Trucks (logTruckActivity)
   * - Departments
   * - Employees
   * - Branches
   * - Locations
   * - User management
   */
  logActivity: async (logData) => {
    try {
      const {
        user_id = null,
        action,
        table_name,
        record_id = null,
        old_values = null,
        new_values = null,
        ip_address,
        user_agent,
        description = "",
      } = logData;

      const sql = `
        INSERT INTO activity_logs 
        (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        user_id,
        action,
        table_name,
        record_id,
        old_values ? JSON.stringify(safeJson(old_values)) : null,
        new_values ? JSON.stringify(safeJson(new_values)) : null,
        ip_address || "unknown",
        user_agent || "unknown",
        description,
      ];

      await dbHelpers.execute(sql, params);

      // Optional: backend logging (tidak mengganggu proses)
      console.log(`📝 [LOG] ${action} → ${table_name} (#${record_id ?? "-"})`);

      return true;
    } catch (error) {
      console.error("❌ Error writing activity log:", error);
      return false;
    }
  },

  /**
   * 🟦 Deteksi alamat IP real (mendukung proxy & load balancer)
   */
  getClientIp: (req) => {
    try {
      return (
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.ip ||
        "unknown"
      );
    } catch {
      return "unknown";
    }
  },

  /**
   * 🟨 User-Agent
   */
  getUserAgent: (req) => {
    try {
      return req.headers["user-agent"] || "unknown";
    } catch {
      return "unknown";
    }
  },

  /**
   * 📋 Get activity logs list dengan filter dan pagination
   * Menggunakan string interpolation untuk LIMIT/OFFSET
   */
  list: async (params = {}) => {
    try {
      const {
        page = 1,
        limit = 50,
        action,
        table_name,
        user,
        q,
        date_from,
        date_to,
      } = params;

      console.log("=== ACTIVITY LOG SERVICE LIST ===");
      console.log("Params:", params);

      // Validasi dan parse
      const validatedPage = Math.max(1, parseInt(page) || 1);
      const validatedLimit = Math.max(1, Math.min(parseInt(limit) || 50, 100)); // max 100 records
      const offset = (validatedPage - 1) * validatedLimit;

      // Build WHERE clause
      const whereConditions = [];
      const whereParams = [];

      if (action) {
        whereConditions.push("al.action = ?");
        whereParams.push(action);
      }

      if (table_name) {
        whereConditions.push("al.table_name = ?");
        whereParams.push(table_name);
      }

      if (user && !isNaN(Number(user))) {
        whereConditions.push("al.user_id = ?");
        whereParams.push(Number(user));
      }

      if (q) {
        whereConditions.push("al.description LIKE ?");
        whereParams.push(`%${q}%`);
      }

      if (date_from) {
        whereConditions.push("al.created_at >= ?");
        whereParams.push(date_from + " 00:00:00");
      }

      if (date_to) {
        whereConditions.push("al.created_at <= ?");
        whereParams.push(date_to + " 23:59:59");
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      console.log("Service - Where clause:", whereClause);
      console.log("Service - Where params:", whereParams);
      console.log("Service - Limit:", validatedLimit, "Offset:", offset);

      // COUNT query
      const countSql = `
        SELECT COUNT(*) AS total
        FROM activity_logs al
        ${whereClause}
      `;

      const countRows = await dbHelpers.query(countSql, whereParams);
      const total = countRows[0]?.total ?? 0;

      // DATA query - FIX: string interpolation untuk LIMIT/OFFSET
      const dataSql = `
        SELECT al.*, u.username
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT ${validatedLimit} OFFSET ${offset}
      `;

      console.log("Service - Data SQL:", dataSql);

      // Hanya kirim whereParams (tanpa limit/offset)
      const logs = await dbHelpers.query(dataSql, whereParams);

      console.log("Service - Query successful. Found:", logs.length, "logs");

      return {
        data: logs,
        pagination: {
          page: validatedPage,
          limit: validatedLimit,
          total: parseInt(total),
        },
      };
    } catch (error) {
      console.error("❌ Error in activityLogService.list:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        sqlState: error.sqlState,
      });
      throw error;
    }
  },
};

/**
 * Helper: sanitize JSON (menghindari circular structure & references)
 * Membuang function & value undefined
 */
function safeJson(data) {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return String(data);
  }
}
