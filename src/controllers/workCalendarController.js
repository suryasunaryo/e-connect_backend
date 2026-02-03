// backend/src/controllers/workCalendarController.js
import { dbHelpers } from "../config/database.js";
import {
  getHolidays,
  fetchAndCacheHolidays,
} from "../services/nationalHolidayService.js";
import { emitDataChange } from "../utils/socketHelpers.js";

// Helper to resolve target names
const resolveTargetNames = async (events) => {
  if (!events || events.length === 0) return events;

  // 1. Collect IDs
  const pools = {
    users: new Set(),
    departments: new Set(),
    roles: new Set(),
    positions: new Set(),
    branches: new Set(),
  };

  events.forEach((e) => {
    if (!e.target_value || !e.target_type) return;
    const ids = e.target_value.split(",").map((id) => id.trim());

    if (e.target_type === "personal" || e.target_type === "user") {
      ids.forEach((id) => id && pools.users.add(id));
    } else if (e.target_type === "department") {
      ids.forEach((id) => id && pools.departments.add(id));
    } else if (e.target_type === "role") {
      ids.forEach((id) => id && pools.roles.add(id));
    } else if (e.target_type === "position") {
      ids.forEach((id) => id && pools.positions.add(id));
    } else if (e.target_type === "branch") {
      ids.forEach((id) => id && pools.branches.add(id));
    }
  });

  // 2. Fetch Data
  const maps = {
    users: {},
    departments: {},
    roles: {},
    positions: {},
    branches: {},
  };

  try {
    if (pools.users.size > 0) {
      const uIds = Array.from(pools.users);
      if (uIds.length > 0) {
        // Safe check for numeric IDs to avoid SQL injection even though it's likely param binding
        // But dbHelpers.query with IN clause needs handling.
        // Simplified: use placeholders.
        const placeholders = uIds.map(() => "?").join(",");
        const rows = await dbHelpers.query(
          `SELECT id, full_name, username FROM users WHERE id IN (${placeholders})`,
          uIds,
        );
        // console.log(`🔍 Found ${rows.length} users for resolution`);
        rows.forEach((r) => {
          maps.users[r.id] = r.full_name || r.username;
          maps.users[r.id.toString()] = r.full_name || r.username;
        });
      }
    }

    if (pools.departments.size > 0) {
      const dIds = Array.from(pools.departments);
      const placeholders = dIds.map(() => "?").join(",");
      const rows = await dbHelpers.query(
        `SELECT id, dept_name, dept_code FROM departments WHERE id IN (${placeholders}) OR dept_code IN (${placeholders})`,
        [...dIds, ...dIds],
      );
      rows.forEach((r) => {
        const name = r.dept_name || r.dept_code;
        if (r.id) {
          maps.departments[r.id] = name;
          maps.departments[r.id.toString()] = name;
        }
        if (r.dept_code) {
          maps.departments[r.dept_code] = name;
          maps.departments[r.dept_code.toString()] = name;
        }
      });
    }

    if (pools.roles.size > 0) {
      const rIds = Array.from(pools.roles);
      const placeholders = rIds.map(() => "?").join(",");
      const rows = await dbHelpers.query(
        `SELECT * FROM users_role WHERE id IN (${placeholders}) OR role_id IN (${placeholders})`,
        [...rIds, ...rIds],
      );
      rows.forEach((r) => {
        const name = r.role_name;
        if (r.id) {
          maps.roles[r.id] = name;
          maps.roles[r.id.toString()] = name;
        }
        if (r.role_id) {
          maps.roles[r.role_id] = name;
          maps.roles[r.role_id.toString()] = name;
        }
      });
    }

    if (pools.positions.size > 0) {
      const pIds = Array.from(pools.positions);
      const placeholders = pIds.map(() => "?").join(",");
      const rows = await dbHelpers.query(
        `SELECT id, position_name FROM positions WHERE id IN (${placeholders})`,
        pIds,
      );
      rows.forEach((r) => {
        maps.positions[r.id] = r.position_name;
        maps.positions[r.id.toString()] = r.position_name;
      });
    }

    if (pools.branches.size > 0) {
      const bIds = Array.from(pools.branches);
      const placeholders = bIds.map(() => "?").join(",");
      const rows = await dbHelpers.query(
        `SELECT id, branch_name FROM branches WHERE id IN (${placeholders})`,
        bIds,
      );
      rows.forEach((r) => {
        maps.branches[r.id] = r.branch_name;
        maps.branches[r.id.toString()] = r.branch_name;
      });
    }
  } catch (error) {
    console.error("Error resolving target names:", error);
    // Continue without names if error
  }

  // 3. Enrich Events
  return events.map((e) => {
    let targetNames = e.target_value; // Default to value
    const vals = e.target_value ? e.target_value.split(",") : [];

    if (
      (e.target_type === "personal" || e.target_type === "user") &&
      Object.keys(maps.users).length > 0
    ) {
      const names = vals
        .map((id) => {
          const trimmed = id.trim();
          return maps.users[trimmed] || maps.users[parseInt(trimmed)];
        })
        .filter((n) => n)
        .join(", ");
      if (names) targetNames = names;
    } else if (
      e.target_type === "department" &&
      Object.keys(maps.departments).length > 0
    ) {
      const names = vals
        .map((id) => {
          const trimmed = id.trim();
          return (
            maps.departments[trimmed] || maps.departments[parseInt(trimmed)]
          );
        })
        .filter((n) => n)
        .join(", ");
      if (names) targetNames = names;
    } else if (e.target_type === "role" && Object.keys(maps.roles).length > 0) {
      const names = vals
        .map((id) => {
          const trimmed = id.trim();
          return (
            maps.roles[trimmed] ||
            maps.roles[parseInt(trimmed)] ||
            maps.roles[trimmed.toString()]
          );
        })
        .filter((n) => n)
        .join(", ");
      if (names) targetNames = names;
    } else if (
      e.target_type === "position" &&
      Object.keys(maps.positions).length > 0
    ) {
      const names = vals
        .map((id) => {
          const trimmed = id.trim();
          return (
            maps.positions[trimmed] ||
            maps.positions[parseInt(trimmed)] ||
            maps.positions[trimmed.toString()]
          );
        })
        .filter((n) => n)
        .join(", ");
      if (names) targetNames = names;
    } else if (
      e.target_type === "branch" &&
      Object.keys(maps.branches).length > 0
    ) {
      const names = vals
        .map((id) => {
          const trimmed = id.trim();
          return (
            maps.branches[trimmed] ||
            maps.branches[parseInt(trimmed)] ||
            maps.branches[trimmed.toString()] ||
            trimmed
          );
        })
        .filter((n) => n)
        .join(", ");
      if (names) targetNames = names;
    }

    return { ...e, target_names: targetNames };
  });
};

/**
 * GET ALL CALENDAR EVENTS (Company + National Holidays)
 */
export const getAllCalendarEvents = async (req, res) => {
  try {
    const { start, end, year } = req.query;
    const currentYear = year || new Date().getFullYear();

    // Get company events
    let companyQuery = `
      SELECT 
        id,
        date,
        type,
        description,
        created_by,
        target_type,
        target_value,
        auto_target_type,
        auto_target_value,
        respons,
        created_at,
        updated_at
      FROM work_calendar 
      WHERE deleted_at IS NULL
    `;
    const params = [];

    if (start && end) {
      companyQuery += " AND date BETWEEN ? AND ?";
      params.push(start, end);
    }

    companyQuery += " ORDER BY date ASC";

    let companyEvents = await dbHelpers.query(companyQuery, params);

    // 2. Fetch National Holidays
    const nationalHolidays = await getHolidays(currentYear);

    // 3. Get event types (colors and metadata)
    const eventTypes = await dbHelpers.query(
      "SELECT code, color, name FROM calendar_event_types WHERE is_deleted = 0",
    );
    const colorMap = {};
    const typeNameMap = {};
    eventTypes.forEach((et) => {
      colorMap[et.code] = et.color;
      typeNameMap[et.code] = et.name;
    });

    // 4. Resolve target names for company events (once)
    const eventsWithNames = await resolveTargetNames(companyEvents);

    // 5. Transform company events to calendar format
    const companyCalendarEvents = eventsWithNames.map((event) => ({
      id: `company-${event.id}`,
      title: event.description || typeNameMap[event.type] || event.type,
      start: event.date,
      type: event.type,
      source: "company",
      color: colorMap[event.type] || "#6B7280",
      extendedProps: {
        dbId: event.id,
        description: event.description,
        created_by: event.created_by,
        creator_name: event.creator_name || event.creator_username,
        target_type: event.target_type,
        target_value: event.target_value,
        target_names: event.target_names,
        auto_target_type: event.auto_target_type,
        auto_target_value: event.auto_target_value,
        respons: event.respons,
        typeName: typeNameMap[event.type] || event.type,
        created_at: event.created_at,
      },
    }));

    // Transform national holidays to calendar format
    const nationalCalendarEvents = nationalHolidays.map((holiday, index) => {
      const type = holiday.is_cuti_bersama
        ? "cuti_bersama"
        : "national_holiday";
      return {
        id: `national-${index}`,
        title: holiday.holiday_name,
        start: holiday.holiday_date,
        type,
        source: "national",
        color: colorMap[type] || "#6B7280",
        extendedProps: {
          isNationalHoliday: holiday.is_national_holiday,
          isCutiBersama: holiday.is_cuti_bersama,
        },
      };
    });

    // Merge and return
    const allEvents = [...companyCalendarEvents, ...nationalCalendarEvents];

    res.json({
      success: true,
      data: allEvents,
      colors: colorMap,
      meta: {
        companyEventsCount: companyCalendarEvents.length,
        nationalHolidaysCount: nationalCalendarEvents.length,
        totalCount: allEvents.length,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching calendar events:", error);
    res.status(500).json({ error: "Failed to fetch calendar events" });
  }
};

/**
 * GET COMPANY EVENTS ONLY
 */
export const getCompanyEvents = async (req, res) => {
  try {
    const events = await dbHelpers.query(
      `SELECT * FROM work_calendar 
       WHERE deleted_at IS NULL
       ORDER BY date ASC`,
    );

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("❌ Error fetching company events:", error);
    res.status(500).json({ error: "Failed to fetch company events" });
  }
};

/**
 * GET NATIONAL HOLIDAYS FOR SPECIFIC YEAR
 */
export const getNationalHolidays = async (req, res) => {
  try {
    const { year } = req.params;
    const holidays = await getHolidays(parseInt(year));

    res.json({
      success: true,
      data: holidays,
      year: parseInt(year),
    });
  } catch (error) {
    console.error("❌ Error fetching national holidays:", error);
    res.status(500).json({ error: "Failed to fetch national holidays" });
  }
};

/**
 * CREATE COMPANY EVENT
 */
export const createCompanyEvent = async (req, res) => {
  try {
    const {
      date,
      type,
      description,
      target_type = "all",
      target_value,
      respons,
    } = req.body;
    const userId = req.user?.id || null;

    // Validate required fields
    if (!date || !type) {
      return res.status(400).json({
        error: "date and type are required",
      });
    }

    // 1. Fetch Auto Target Settings from Event Type
    const eventTypeConfig = await dbHelpers.queryOne(
      "SELECT auto_target_type, auto_target_value, name FROM calendar_event_types WHERE code = ? AND is_deleted = 0",
      [type],
    );

    const autoTargetType = eventTypeConfig?.auto_target_type || null;
    const autoTargetValue = eventTypeConfig?.auto_target_value || null;
    const eventName = eventTypeConfig?.name || type;

    // 2. Create event with both Manual and Auto targets
    const result = await dbHelpers.execute(
      `INSERT INTO work_calendar 
       (date, type, description, created_by, target_type, target_value, auto_target_type, auto_target_value, respons) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        date,
        type,
        description || null,
        userId,
        target_type,
        target_value || null,
        autoTargetType,
        autoTargetValue,
        respons || null,
      ],
    );

    // Update is_used in calendar_event_types
    await dbHelpers.execute(
      "UPDATE calendar_event_types SET is_used = 1 WHERE code = ?",
      [type],
    );

    const newEvent = await dbHelpers.queryOne(
      "SELECT * FROM work_calendar WHERE id = ?",
      [result.insertId],
    );

    // Emit socket event
    emitDataChange("work_calendar", "create", newEvent);

    // 3. Update Notification Logic to include BOTH targets
    const createTargetedNotifications = async () => {
      const { createNotification } =
        await import("./notificationController.js");

      // Helper to format target names
      const formatTargetMsg = (tType, tValue) => {
        if (!tType || tType === "all") return "Semua";
        if (tType === "user" || tType === "personal") return "Anda";
        return `Grup ${tType}`;
      };

      const manualMsg = formatTargetMsg(target_type, target_value);
      const autoMsg = formatTargetMsg(autoTargetType, autoTargetValue);
      const targetMsg =
        manualMsg === autoMsg ? manualMsg : `${manualMsg} & ${autoMsg}`;

      const notifBase = {
        type: "info",
        title: "Jadwal Baru Dibuat",
        message: `Event '${eventName}' telah ditambahkan ke kalender untuk ${targetMsg}.`,
        link: `/work-calendar?date=${date}&view=detail&id=${result.insertId}`,
        item_type: "calendar_event",
        item_id: result.insertId.toString(),
      };

      // Helper to resolve users from a target definition
      const resolveUsers = async (tType, tValue) => {
        if (!tType || tType === "all") return null; // Broadcast
        if (!tValue) return [];

        const rawIds = tValue.split(",").map((v) => v.trim());
        if (rawIds.length === 0) return [];

        let ids = [];
        try {
          if (tType === "user" || tType === "personal") {
            ids = rawIds.map(Number);
          } else if (tType === "department") {
            // NOTE: Check employees table, not users table, for organizational structure targets (dept, branch, position)
            const rows = await dbHelpers.query(
              `SELECT user_id FROM employees WHERE department_id IN (${rawIds.map(() => "?").join(",")}) AND user_id IS NOT NULL`,
              rawIds,
            );
            ids = rows.map((r) => r.user_id);
          } else if (tType === "branch") {
            const rows = await dbHelpers.query(
              `SELECT user_id FROM employees WHERE branch_id IN (${rawIds.map(() => "?").join(",")}) AND user_id IS NOT NULL`,
              rawIds,
            );
            ids = rows.map((r) => r.user_id);
          } else if (tType === "role") {
            // Role usually exists in users table (as 'role' or 'role_id')
            const rows = await dbHelpers.query(
              `SELECT id FROM users WHERE role IN (${rawIds.map(() => "?").join(",")})`,
              rawIds,
            );
            ids = rows.map((r) => r.id);
          } else if (tType === "position") {
            const rows = await dbHelpers.query(
              `SELECT user_id FROM employees WHERE position_id IN (${rawIds.map(() => "?").join(",")}) AND user_id IS NOT NULL`,
              rawIds,
            );
            ids = rows.map((r) => r.user_id);
          }
        } catch (err) {
          console.error(`Error resolving users for ${tType}:`, err);
        }
        return ids;
      };

      // Resolve targets
      const manualUserIds = await resolveUsers(target_type, target_value);
      const autoUserIds = await resolveUsers(autoTargetType, autoTargetValue);

      // If EITHER is null (broadcast), send broadcast
      if (manualUserIds === null || autoUserIds === null) {
        await createNotification({ ...notifBase, user_id: null });
        return;
      }

      // Combine unique IDs
      const allUserIds = Array.from(
        new Set([...manualUserIds, ...autoUserIds]),
      ).filter((id) => id);

      for (const uid of allUserIds) {
        await createNotification({ ...notifBase, user_id: uid });
      }
    };

    await createTargetedNotifications();

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: newEvent,
    });
  } catch (error) {
    console.error("❌ Error creating company event:", error);
    res.status(500).json({ error: error.message || "Failed to create event" });
  }
};

/**
 * UPDATE COMPANY EVENT
 */
export const updateCompanyEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      date,
      type,
      description,
      target_type,
      target_value,
      respons,
      // Optional: allow updating auto targets manually if needed, or refresh from type
      refresh_auto_target,
    } = req.body;

    // Check if event exists
    const existing = await dbHelpers.queryOne(
      "SELECT * FROM work_calendar WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!existing) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Authorization check: Only creator or Admin/HR
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const isAdmin =
      userRole === "admin" ||
      userRole === "30" ||
      userRole === "HR" ||
      userRole === "hr";

    if (existing.created_by !== userId && !isAdmin) {
      return res.status(403).json({
        error: "Unauthorized: Only the creator or admin can update this event",
      });
    }

    let { auto_target_type, auto_target_value } = existing;

    // If type changed or explicitly requested, refresh auto targets from type config
    if ((type && type !== existing.type) || refresh_auto_target) {
      const eventTypeConfig = await dbHelpers.queryOne(
        "SELECT auto_target_type, auto_target_value FROM calendar_event_types WHERE code = ?",
        [type || existing.type],
      );
      if (eventTypeConfig) {
        auto_target_type = eventTypeConfig.auto_target_type;
        auto_target_value = eventTypeConfig.auto_target_value;
      }
    }

    // Update event
    await dbHelpers.execute(
      `UPDATE work_calendar 
       SET date = ?, 
           type = ?, 
           description = ?, 
           target_type = ?, 
           target_value = ?, 
           auto_target_type = ?,
           auto_target_value = ?,
           respons = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [
        date || existing.date,
        type || existing.type,
        description !== undefined ? description : existing.description,
        target_type || existing.target_type,
        target_value !== undefined ? target_value : existing.target_value,
        auto_target_type,
        auto_target_value,
        respons !== undefined ? respons : existing.respons,
        id,
      ],
    );

    // Update is_used in calendar_event_types for the new type
    if (type) {
      await dbHelpers.execute(
        "UPDATE calendar_event_types SET is_used = 1 WHERE code = ?",
        [type],
      );
    }

    const updatedEvent = await dbHelpers.queryOne(
      "SELECT * FROM work_calendar WHERE id = ?",
      [id],
    );

    // Emit socket event
    emitDataChange("work_calendar", "update", updatedEvent);

    res.json({
      success: true,
      message: "Event updated successfully",
      data: updatedEvent,
    });
  } catch (error) {
    console.error("❌ Error updating company event:", error);
    res.status(500).json({ error: error.message || "Failed to update event" });
  }
};

/**
 * DELETE COMPANY EVENT (SOFT DELETE)
 */
export const deleteCompanyEvent = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if event exists
    const existing = await dbHelpers.queryOne(
      "SELECT * FROM work_calendar WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!existing) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Authorization check: Only creator or Admin/HR
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const isAdmin =
      userRole === "admin" ||
      userRole === "30" ||
      userRole === "HR" ||
      userRole === "hr";

    if (existing.created_by !== userId && !isAdmin) {
      return res.status(403).json({
        error: "Unauthorized: Only the creator or admin can delete this event",
      });
    }

    // Soft delete
    await dbHelpers.execute(
      "UPDATE work_calendar SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id],
    );

    // Emit socket event
    emitDataChange("work_calendar", "delete", { id });

    res.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting company event:", error);
    res.status(500).json({ error: error.message || "Failed to delete event" });
  }
};

/**
 * MANUALLY REFRESH NATIONAL HOLIDAYS CACHE
 */
export const refreshNationalHolidays = async (req, res) => {
  try {
    const { year } = req.params;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const holidays = await fetchAndCacheHolidays(targetYear);

    // Emit socket event
    emitDataChange("national_holidays", "update", {
      year: targetYear,
      count: holidays.length,
    });

    res.json({
      success: true,
      message: `National holidays refreshed for year ${targetYear}`,
      data: holidays,
      count: holidays.length,
    });
  } catch (error) {
    console.error("❌ Error refreshing national holidays:", error);
    res.status(500).json({
      error: "Failed to refresh national holidays",
      message: error.message,
    });
  }
};

/**
 * GET EVENT COLORS
 */
export const getEventColors = async (req, res) => {
  try {
    const colors = await dbHelpers.query(
      "SELECT event_type, color FROM event_colors ORDER BY event_type",
    );

    res.json({
      success: true,
      data: colors,
    });
  } catch (error) {
    console.error("❌ Error fetching event colors:", error);
    res.status(500).json({ error: "Failed to fetch event colors" });
  }
};

/**
 * UPDATE EVENT COLOR
 */
export const updateEventColor = async (req, res) => {
  try {
    const { eventType } = req.params;
    const { color } = req.body;

    if (!color || !/^#[0-9A-F]{6}$/i.test(color)) {
      return res.status(400).json({
        error: "Invalid color format. Must be hex color (e.g., #FF5733)",
      });
    }

    const validTypes = [
      "company_anniversary",
      "replacement_workday",
      "replacement_holiday",
      "sto_audit",
      "national_holiday",
      "cuti_bersama",
      "other",
    ];

    if (!validTypes.includes(eventType)) {
      return res.status(400).json({
        error: `Invalid event type. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    await dbHelpers.execute(
      "UPDATE event_colors SET color = ? WHERE event_type = ?",
      [color, eventType],
    );

    const updated = await dbHelpers.queryOne(
      "SELECT * FROM event_colors WHERE event_type = ?",
      [eventType],
    );

    // Emit socket event
    emitDataChange("work_calendar_colors", "update", updated);

    res.json({
      success: true,
      message: "Event color updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("❌ Error updating event color:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to update event color" });
  }
};
