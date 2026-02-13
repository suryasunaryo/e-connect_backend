import { dbHelpers } from "../config/database.js";

/**
 * 📋 Get all available dashboard cards
 */
export const getAvailableCards = async (req, res) => {
  try {
    const cards = await dbHelpers.query(
      `SELECT id, card_key, card_name, card_description, card_category, 
              default_visible, display_order,
              default_x, default_y, default_w, default_h
       FROM dashboard_cards 
       ORDER BY display_order ASC`,
    );
    res.json({ success: true, data: cards });
  } catch (error) {
    console.error("❌ Get available cards error:", error);
    res.status(500).json({ error: "Gagal mengambil daftar card" });
  }
};

/**
 * 👤 Get user's card preferences
 * If user has no preferences yet, return defaults from dashboard_cards
 */
export const getUserCardPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get all available cards with their global defaults
    const allCards = await dbHelpers.query(
      `SELECT id, card_key, default_visible, display_order,
              default_x, default_y, default_w, default_h
       FROM dashboard_cards`,
    );

    // 2. Get user's current preferences
    const existingPrefs = await dbHelpers.query(
      `SELECT card_id FROM user_dashboard_preferences WHERE user_id = ?`,
      [userId],
    );
    const existingCardIds = new Set(existingPrefs.map((p) => p.card_id));

    // 3. Sync missing cards: If a card exists in global but not in user prefs, add it
    for (const card of allCards) {
      if (!existingCardIds.has(card.id)) {
        await dbHelpers.execute(
          `INSERT INTO user_dashboard_preferences (user_id, card_id, is_visible, display_order, x, y, w, h)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            card.id,
            card.default_visible,
            card.display_order,
            card.default_x ?? 0,
            card.default_y ?? 0,
            card.default_w ?? 6,
            card.default_h ?? 4,
          ],
        );
      }
    }

    // 4. Return the fully synchronized preferences
    const finalPrefs = await dbHelpers.query(
      `SELECT udp.id, udp.card_id, udp.is_visible, udp.display_order,
              udp.x, udp.y, udp.w, udp.h,
              dc.card_key, dc.card_name, dc.card_description, dc.card_category
       FROM user_dashboard_preferences udp
       JOIN dashboard_cards dc ON udp.card_id = dc.id
       WHERE udp.user_id = ?
       ORDER BY udp.display_order ASC`,
      [userId],
    );

    res.json({ success: true, data: finalPrefs });
  } catch (error) {
    console.error("❌ Get user card preferences error:", error);
    res.status(500).json({ error: "Gagal mengambil preferensi card" });
  }
};

/**
 * ✏️ Update single card preference
 */
export const updateCardPreference = async (req, res) => {
  try {
    const userId = req.user.id;
    const { cardId } = req.params;
    const { is_visible, display_order, x, y, w, h } = req.body;

    // Check if preference exists
    const existing = await dbHelpers.queryOne(
      `SELECT id FROM user_dashboard_preferences 
       WHERE user_id = ? AND card_id = ?`,
      [userId, cardId],
    );

    if (existing) {
      // Update existing preference
      await dbHelpers.execute(
        `UPDATE user_dashboard_preferences 
         SET is_visible = ?, display_order = ?, x = ?, y = ?, w = ?, h = ?
         WHERE user_id = ? AND card_id = ?`,
        [
          is_visible,
          display_order,
          x || 0,
          y || 0,
          w || 12,
          h || 4,
          userId,
          cardId,
        ],
      );
    } else {
      // Create new preference
      await dbHelpers.execute(
        `INSERT INTO user_dashboard_preferences (user_id, card_id, is_visible, display_order, x, y, w, h)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          cardId,
          is_visible,
          display_order,
          x || 0,
          y || 0,
          w || 12,
          h || 4,
        ],
      );
    }

    res.json({ success: true, message: "Preferensi card berhasil diperbarui" });
  } catch (error) {
    console.error("❌ Update card preference error:", error);
    res.status(500).json({ error: "Gagal memperbarui preferensi card" });
  }
};

/**
 * 🔄 Bulk update card preferences
 */
export const bulkUpdateCardPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { preferences } = req.body; // Array of { card_id, is_visible, display_order, x, y, w, h }

    if (!Array.isArray(preferences)) {
      return res.status(400).json({ error: "Preferences harus berupa array" });
    }

    // Update each preference
    for (const pref of preferences) {
      const { card_id, is_visible, display_order, x, y, w, h } = pref;

      const existing = await dbHelpers.queryOne(
        `SELECT id FROM user_dashboard_preferences 
         WHERE user_id = ? AND card_id = ?`,
        [userId, card_id],
      );

      if (existing) {
        await dbHelpers.execute(
          `UPDATE user_dashboard_preferences 
           SET is_visible = ?, display_order = ?, x = ?, y = ?, w = ?, h = ?
           WHERE user_id = ? AND card_id = ?`,
          [
            is_visible,
            display_order,
            x || 0,
            y || 0,
            w || 12,
            h || 4,
            userId,
            card_id,
          ],
        );
      } else {
        await dbHelpers.execute(
          `INSERT INTO user_dashboard_preferences (user_id, card_id, is_visible, display_order, x, y, w, h)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            card_id,
            is_visible,
            display_order,
            x || 0,
            y || 0,
            w || 12,
            h || 4,
          ],
        );
      }
    }

    res.json({
      success: true,
      message: "Semua preferensi card berhasil diperbarui",
    });
  } catch (error) {
    console.error("❌ Bulk update card preferences error:", error);
    res.status(500).json({ error: "Gagal memperbarui preferensi card" });
  }
};

/**
 * 🛠️ Update global default card preferences (Admin only)
 */
export const updateGlobalCardDefaults = async (req, res) => {
  try {
    const { preferences } = req.body; // Array of { card_id, is_visible, display_order, x, y, w, h }

    if (!Array.isArray(preferences)) {
      return res.status(400).json({ error: "Preferences harus berupa array" });
    }

    // Update each global default in dashboard_cards
    for (const pref of preferences) {
      const { card_id, is_visible, display_order, x, y, w, h } = pref;

      await dbHelpers.execute(
        `UPDATE dashboard_cards 
         SET default_visible = ?, display_order = ?, 
             default_x = ?, default_y = ?, default_w = ?, default_h = ?
         WHERE id = ?`,
        [is_visible, display_order, x ?? 0, y ?? 0, w ?? 6, h ?? 4, card_id],
      );
    }

    res.json({
      success: true,
      message: "Default dashboard global berhasil diperbarui",
    });
  } catch (error) {
    console.error("❌ Update global card defaults error:", error);
    res.status(500).json({ error: "Gagal memperbarui default global" });
  }
};

/**
 * 🔄 Reset to default preferences
 */
export const resetToDefaults = async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete existing preferences
    await dbHelpers.execute(
      `DELETE FROM user_dashboard_preferences WHERE user_id = ?`,
      [userId],
    );

    // Get default cards
    const defaultCards = await dbHelpers.query(
      `SELECT id, default_visible, display_order,
              default_x, default_y, default_w, default_h
       FROM dashboard_cards
       ORDER BY display_order ASC`,
    );

    // Insert default preferences
    for (const card of defaultCards) {
      await dbHelpers.execute(
        `INSERT INTO user_dashboard_preferences (user_id, card_id, is_visible, display_order, x, y, w, h)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          card.id,
          card.default_visible,
          card.display_order,
          card.default_x ?? 0,
          card.default_y ?? 0,
          card.default_w ?? 6,
          card.default_h ?? 4,
        ],
      );
    }

    // Get the fresh synchronized preferences to return to frontend
    const freshPrefs = await dbHelpers.query(
      `SELECT udp.id, udp.card_id, udp.is_visible, udp.display_order,
              udp.x, udp.y, udp.w, udp.h,
              dc.card_key, dc.card_name, dc.card_description, dc.card_category
       FROM user_dashboard_preferences udp
       JOIN dashboard_cards dc ON udp.card_id = dc.id
       WHERE udp.user_id = ?
       ORDER BY udp.display_order ASC`,
      [userId],
    );

    res.json({
      success: true,
      message: "Preferensi card berhasil direset ke default",
      data: freshPrefs,
    });
  } catch (error) {
    console.error("❌ Reset to defaults error:", error);
    res.status(500).json({ error: "Gagal mereset preferensi card" });
  }
};

/**
 * 👥 Get Who's Online
 * Returns currently logged-in users based on recent activity
 * - Admin users: See all online users
 * - Regular users: Only see users from their own department
 */
export const getWhosOnline = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role; // role name (e.g., "admin", "user")

    // Get current user's department
    const currentUserData = await dbHelpers.queryOne(
      `SELECT e.department_id 
       FROM employees e 
       WHERE e.user_id = ?`,
      [currentUserId],
    );

    const currentDepartmentId = currentUserData?.department_id;

    // Build the query based on user role
    let query = `
      SELECT 
        u.id,
        u.full_name,
        u.email,
        u.profile_picture as picture,
        u.last_activity,
        e.position_id,
        e.department_id,
        p.position_name,
        d.dept_name as department_name
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE u.last_activity >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
        AND u.deleted_at IS NULL
        AND u.is_active = 1
    `;

    const params = [];

    // If not admin role, filter by department
    if (currentUserRole !== "admin") {
      if (currentDepartmentId) {
        query += ` AND e.department_id = ?`;
        params.push(currentDepartmentId);
      } else {
        // If user has no department, show only themselves
        query += ` AND u.id = ?`;
        params.push(currentUserId);
      }
    }

    query += ` ORDER BY u.last_activity DESC`;

    const onlineUsers = await dbHelpers.query(query, params);

    res.json({ success: true, data: onlineUsers });
  } catch (error) {
    console.error("❌ Get who's online error:", error);
    res.status(500).json({ error: "Gagal mengambil daftar user online" });
  }
};

import { getHolidays } from "../services/nationalHolidayService.js";

/**
 * 📅 Get Calendar Events for Widget
 * Returns calendar events for the specified month, filtered by user permissions
 */
export const getCalendarEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = req.user;
    const { month, year } = req.query;

    // Default to current month/year if not provided
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    // 1. Get company events for the specified month
    const companyEvents = await dbHelpers.query(
      `SELECT 
        id,
        description as title,
        date as start,
        date as end,
        type,
        '#3B82F6' as color,
        'local' as source,
        target_type,
        target_value,
        auto_target_type,
        auto_target_value,
        created_by
      FROM work_calendar
      WHERE YEAR(date) = ? 
        AND MONTH(date) = ?
        AND deleted_at IS NULL
      ORDER BY date ASC`,
      [targetYear, targetMonth],
    );

    // 2. Filter company events based on permissions
    const filteredCompanyEvents = companyEvents.filter((event) => {
      // Helper function to check target match
      const checkTarget = (tType, tValue) => {
        if (!tType || !tValue) return false;
        const targets = tValue.split(",").map((v) => v.trim());

        if (tType === "personal" || tType === "user") {
          return targets.includes(user.id?.toString());
        }
        if (tType === "department") {
          return targets.includes(user.department_id?.toString() || "");
        }
        if (tType === "branch") {
          return targets.includes(user.branch_id?.toString() || "");
        }
        if (tType === "position") {
          return targets.includes(user.position_id?.toString() || "");
        }
        if (tType === "role") {
          const userRoleId = user.role_id?.toString() || "";
          const userRoleName = user.role || "";
          return targets.includes(userRoleId) || targets.includes(userRoleName);
        }
        return false;
      };

      // Events with target "ALL"
      if (
        !event.target_type ||
        event.target_type === "all" ||
        event.auto_target_type === "all"
      ) {
        return true;
      }

      // Events with specific target (Manual OR Auto)
      if (
        checkTarget(event.target_type, event.target_value) ||
        checkTarget(event.auto_target_type, event.auto_target_value)
      ) {
        return true;
      }

      // Personal events created by the user
      if (event.created_by === userId) return true;

      return false;
    });

    // 3. Fetch National Holidays for the year
    const holidays = await getHolidays(targetYear);

    // 4. Filter holidays for the requested month
    const monthlyHolidays = holidays
      .filter((h) => {
        const hDate = new Date(h.holiday_date);
        return hDate.getMonth() + 1 === targetMonth;
      })
      .map((h, i) => ({
        id: `holiday-${i}`,
        title: h.holiday_name,
        start: h.holiday_date,
        type: h.is_cuti_bersama ? "cuti_bersama" : "national_holiday",
        color: "#EF4444", // Red for holidays
        source: "national",
      }));

    // 5. Merge events
    const allEvents = [...filteredCompanyEvents, ...monthlyHolidays].sort(
      (a, b) => new Date(a.start) - new Date(b.start),
    );

    res.json({ success: true, data: allEvents });
  } catch (error) {
    console.error("❌ Get calendar events error:", error);
    res.status(500).json({ error: "Gagal mengambil calendar events" });
  }
};
