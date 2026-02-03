// middleware/activityLogger.js
import { activityLogService } from "../services/activityLogService.js";
import { dbHelpers } from "../config/database.js";

export const activityLogger = {
  /**
   * ============================================================
   * 🚛 SPECIAL LOGGER UNTUK TRUCK MODULE (TETAP DIPERTAHANKAN)
   * ============================================================
   */
  logTruckActivity: (action, getDescription = null) => {
    return async (req, res, next) => {
      const originalJson = res.json;

      res.json = function (data) {
        // always send response first
        originalJson.call(this, data);

        // logging async agar tidak menghambat response
        setTimeout(async () => {
          try {
            const user_id = req.user?.id || null;
            const record_id =
              req.params.id || data?.id || data?.data?.id || null;

            let description = getDescription
              ? getDescription(req, data)
              : `${action} truck ${record_id ? `#${record_id}` : ""}`;

            // Untuk CREATE: catat semua field dari request body
            let new_values = null;
            let old_values = null;

            if (action === "CREATE") {
              new_values = req.body;
            } else if (action === "UPDATE") {
              // Untuk UPDATE, old_values akan diambil sebelum update (di middleware utama)
              new_values = req.body;
            }

            await activityLogService.logActivity({
              user_id,
              action,
              table_name: "trucks",
              record_id,
              old_values,
              new_values,
              ip_address: activityLogService.getClientIp(req),
              user_agent: activityLogService.getUserAgent(req),
              description,
            });
          } catch (error) {
            console.error("❌ Truck Logger Error:", error);
          }
        }, 0);
      };

      next();
    };
  },

  /**
   * ============================================================
   * ⭐ GENERIC LOGGER UNTUK SEMUA MODULE - IMPROVED
   * ============================================================
   */
  logModuleActivity: (tableName, action) => {
    return async (req, res, next) => {
      // ❌ Mencegah logging modul activity_logs (avoid infinite loop)
      if (tableName === "activity_logs") return next();

      let old_values = null;
      let record_id = req.params.id || null;
      let recordName = null; // Untuk menyimpan nama/identifier yang lebih deskriptif

      /**
       * ============================================
       * Ambil old values sebelum UPDATE / DELETE
       * ============================================
       */
      try {
        if (["UPDATE", "DELETE"].includes(action)) {
          if (record_id) {
            const rows = await dbHelpers.query(
              `SELECT * FROM ${tableName} WHERE id=? LIMIT 1`,
              [record_id]
            );
            old_values = rows?.[0] ?? null;

            // Extract descriptive name based on table
            if (old_values) {
              recordName = extractRecordName(tableName, old_values);
            }
          }
        }
      } catch (err) {
        console.error(`❌ Failed reading old values for ${tableName}:`, err);
      }

      const originalJson = res.json;

      res.json = function (data) {
        /**
         * =======================================================
         * ⛔ FIX: Skip logging untuk GET LIST (array response)
         * =======================================================
         */
        if (Array.isArray(data)) {
          res.json = originalJson;
          return originalJson.call(this, data);
        }

        // kirim response terlebih dahulu
        originalJson.call(this, data);

        /**
         * =======================================================
         * Logging dilakukan async setelah response dikirim
         * =======================================================
         */
        setTimeout(async () => {
          try {
            const user_id = req.user?.id || null;

            // Update record_id dari response jika tidak ada di params
            if (!record_id) {
              record_id = data?.id || data?.data?.id || null;
            }

            // Extract name for CREATE action
            if (action === "CREATE" && !recordName) {
              const newData = data?.data || req.body;
              recordName = extractRecordName(tableName, newData);
            }

            // Extract name for CREATE_USER action
            if (action === "CREATE_USER" && !recordName) {
              const employeeData = old_values || req.body;
              recordName = extractRecordName(tableName, employeeData);
            }

            let description = "";
            let new_values = null;

            // Tentukan data yang akan dicatat berdasarkan action
            switch (action) {
              case "CREATE":
                new_values = req.body;
                description = `Created new ${getSingularName(tableName)}`;
                if (recordName) {
                  description += `: ${recordName}`;
                } else if (record_id) {
                  description += ` #${record_id}`;
                }
                break;

              case "UPDATE":
                new_values = req.body;
                description = `Updated ${getSingularName(tableName)}`;
                if (recordName) {
                  description += `: ${recordName}`;
                } else {
                  description += ` #${record_id}`;
                }

                // Filter hanya field yang berubah
                if (old_values && new_values) {
                  const changedFields = {};
                  Object.keys(new_values).forEach((key) => {
                    if (new_values[key] !== old_values[key]) {
                      changedFields[key] = {
                        old: old_values[key],
                        new: new_values[key],
                      };
                    }
                  });
                  if (Object.keys(changedFields).length > 0) {
                    new_values = changedFields;
                  }
                }
                break;

              case "DELETE":
                description = `Deleted ${getSingularName(tableName)}`;
                if (recordName) {
                  description += `: ${recordName}`;
                } else {
                  description += ` #${record_id}`;
                }
                // Untuk DELETE, new_values adalah null
                new_values = null;
                break;

              case "READ":
                description = `Viewed ${getSingularName(tableName)}`;
                if (recordName) {
                  description += `: ${recordName}`;
                } else {
                  description += ` #${record_id}`;
                }
                // Untuk READ, tidak perlu menyimpan data lengkap
                new_values = { action: "view_details" };
                break;

              case "CREATE_USER":
                description = `Created user account for employee`;
                if (recordName) {
                  description += `: ${recordName}`;
                } else {
                  description += ` #${record_id}`;
                }
                new_values = {
                  employee_id: record_id,
                  role: req.body.role,
                  username: old_values?.nik || "unknown",
                };
                break;

              default:
                description = `${action} on ${getSingularName(tableName)}`;
                if (recordName) {
                  description += `: ${recordName}`;
                } else if (record_id) {
                  description += ` #${record_id}`;
                }
                new_values = req.body;
            }

            await activityLogService.logActivity({
              user_id,
              action,
              table_name: tableName,
              record_id,
              old_values,
              new_values,
              ip_address: activityLogService.getClientIp(req),
              user_agent: activityLogService.getUserAgent(req),
              description,
            });

            console.log(
              `📝 [ACTIVITY] ${action} → ${tableName} (#${record_id}): ${
                recordName || "N/A"
              }`
            );
          } catch (error) {
            console.error("❌ Generic Module Logger Error:", error);
          }
        }, 0);
      };

      next();
    };
  },

  /**
   * ============================================================
   * 👤 USER ACTIVITY LOGGER - IMPROVED
   * ============================================================
   */
  logUserActivity: (action) => {
    return async (req, res, next) => {
      let old_values = null;
      const record_id = req.params.id || null;

      try {
        if (["UPDATE", "DELETE"].includes(action)) {
          if (record_id) {
            const rows = await dbHelpers.query(
              `SELECT id, username, role, full_name, email, is_active, menu_groups, menu_access FROM users WHERE id=? LIMIT 1`,
              [record_id]
            );
            old_values = rows?.[0] ?? null;
          }
        }
      } catch (err) {
        console.error(`❌ Failed reading old values for users:`, err);
      }

      const originalJson = res.json;

      res.json = function (data) {
        if (Array.isArray(data)) {
          res.json = originalJson;
          return originalJson.call(this, data);
        }

        originalJson.call(this, data);

        setTimeout(async () => {
          try {
            const user_id = req.user?.id || null;
            const final_record_id =
              record_id || data?.id || data?.data?.id || null;

            let description = "";
            let new_values = null;

            switch (action) {
              case "CREATE":
                new_values = req.body;
                description = `Created new user: ${
                  req.body.username || "Unknown"
                }`;
                break;

              case "UPDATE":
                new_values = req.body;
                const username =
                  old_values?.username || data?.username || "Unknown";
                description = `Updated user: ${username}`;

                // Track perubahan spesifik
                if (old_values && new_values) {
                  const changes = {};
                  Object.keys(new_values).forEach((key) => {
                    if (new_values[key] !== old_values[key]) {
                      changes[key] = {
                        old: old_values[key],
                        new: new_values[key],
                      };
                    }
                  });
                  if (Object.keys(changes).length > 0) {
                    new_values = changes;
                  }
                }
                break;

              case "DELETE":
                description = `Deleted user: ${
                  old_values?.username || "Unknown"
                }`;
                break;

              default:
                description = `${action} user operation`;
                new_values = req.body;
            }

            await activityLogService.logActivity({
              user_id,
              action,
              table_name: "users",
              record_id: final_record_id,
              old_values,
              new_values,
              ip_address: activityLogService.getClientIp(req),
              user_agent: activityLogService.getUserAgent(req),
              description,
            });
          } catch (error) {
            console.error("❌ User Logger Error:", error);
          }
        }, 0);
      };

      next();
    };
  },

  /**
   * ============================================================
   * 🔐 AUTH ACTIVITY LOGGER
   * ============================================================
   */
  logAuthActivity: (action) => {
    return async (req, res, next) => {
      const originalJson = res.json;

      res.json = function (data) {
        originalJson.call(this, data);

        setTimeout(async () => {
          try {
            const user_id = data?.user?.id || req.user?.id || null;
            const username =
              data?.user?.username || req.body?.username || "unknown";

            await activityLogService.logActivity({
              user_id,
              action,
              table_name: "users",
              record_id: user_id,
              old_values: null,
              new_values: {
                username,
                action,
                timestamp: new Date().toISOString(),
              },
              ip_address: activityLogService.getClientIp(req),
              user_agent: activityLogService.getUserAgent(req),
              description: `${action} by ${username}`,
            });
          } catch (error) {
            console.error("❌ Auth Logger Error:", error);
          }
        }, 0);
      };

      next();
    };
  },
};

/**
 * ============================================================
 * 🔧 HELPER FUNCTIONS
 * ============================================================
 */

/**
 * Extract descriptive name from record based on table type
 */
function extractRecordName(tableName, record) {
  if (!record) return null;

  switch (tableName) {
    case "employees":
      return record.full_name || record.nik || null;

    case "departments":
      return record.dept_name || record.dept_code || null;

    case "branches":
      return record.branch_name || null;

    case "positions":
      return record.position_name || record.name || null;

    case "titles":
      return record.title_name || record.name || null;

    case "locations":
      return record.location_name || record.name || null;

    case "work_calendar":
      return record.description || record.date || null;

    case "users":
      return record.username || record.full_name || null;

    default:
      // Try common name fields
      return record.name || record.title || record.description || null;
  }
}

/**
 * Get singular name for table
 */
function getSingularName(tableName) {
  const singularMap = {
    employees: "employee",
    departments: "department",
    branches: "branch",
    positions: "position",
    titles: "title",
    locations: "location",
    work_calendar: "calendar event",
    users: "user",
  };

  return singularMap[tableName] || tableName.replace(/s$/, "");
}
