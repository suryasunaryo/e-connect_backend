import { dbHelpers } from "../config/database.js";

/**
 * 📋 Get all available dashboard cards
 */
export const getAvailableCards = async (req, res) => {
  try {
    const cards = await dbHelpers.query(
      `SELECT id, card_key, card_name, card_description, card_category, 
              default_visible, display_order 
       FROM dashboard_cards 
       ORDER BY display_order ASC`
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

    // Check if user has any preferences
    const existingPrefs = await dbHelpers.query(
      `SELECT udp.id, udp.card_id, udp.is_visible, udp.display_order,
              dc.card_key, dc.card_name, dc.card_description, dc.card_category
       FROM user_dashboard_preferences udp
       JOIN dashboard_cards dc ON udp.card_id = dc.id
       WHERE udp.user_id = ?
       ORDER BY udp.display_order ASC`,
      [userId]
    );

    // If user has preferences, return them
    if (existingPrefs.length > 0) {
      return res.json({ success: true, data: existingPrefs });
    }

    // Otherwise, initialize with defaults
    const defaultCards = await dbHelpers.query(
      `SELECT id, card_key, card_name, card_description, card_category, 
              default_visible as is_visible, display_order
       FROM dashboard_cards
       ORDER BY display_order ASC`
    );

    // Insert default preferences for this user
    for (const card of defaultCards) {
      await dbHelpers.execute(
        `INSERT INTO user_dashboard_preferences (user_id, card_id, is_visible, display_order)
         VALUES (?, ?, ?, ?)`,
        [userId, card.id, card.is_visible, card.display_order]
      );
    }

    // Return the newly created preferences
    const newPrefs = await dbHelpers.query(
      `SELECT udp.id, udp.card_id, udp.is_visible, udp.display_order,
              dc.card_key, dc.card_name, dc.card_description, dc.card_category
       FROM user_dashboard_preferences udp
       JOIN dashboard_cards dc ON udp.card_id = dc.id
       WHERE udp.user_id = ?
       ORDER BY udp.display_order ASC`,
      [userId]
    );

    res.json({ success: true, data: newPrefs });
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
    const { is_visible, display_order } = req.body;

    // Check if preference exists
    const existing = await dbHelpers.queryOne(
      `SELECT id FROM user_dashboard_preferences 
       WHERE user_id = ? AND card_id = ?`,
      [userId, cardId]
    );

    if (existing) {
      // Update existing preference
      await dbHelpers.execute(
        `UPDATE user_dashboard_preferences 
         SET is_visible = ?, display_order = ?
         WHERE user_id = ? AND card_id = ?`,
        [is_visible, display_order, userId, cardId]
      );
    } else {
      // Create new preference
      await dbHelpers.execute(
        `INSERT INTO user_dashboard_preferences (user_id, card_id, is_visible, display_order)
         VALUES (?, ?, ?, ?)`,
        [userId, cardId, is_visible, display_order]
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
    const { preferences } = req.body; // Array of { card_id, is_visible, display_order }

    if (!Array.isArray(preferences)) {
      return res.status(400).json({ error: "Preferences harus berupa array" });
    }

    // Update each preference
    for (const pref of preferences) {
      const { card_id, is_visible, display_order } = pref;

      const existing = await dbHelpers.queryOne(
        `SELECT id FROM user_dashboard_preferences 
         WHERE user_id = ? AND card_id = ?`,
        [userId, card_id]
      );

      if (existing) {
        await dbHelpers.execute(
          `UPDATE user_dashboard_preferences 
           SET is_visible = ?, display_order = ?
           WHERE user_id = ? AND card_id = ?`,
          [is_visible, display_order, userId, card_id]
        );
      } else {
        await dbHelpers.execute(
          `INSERT INTO user_dashboard_preferences (user_id, card_id, is_visible, display_order)
           VALUES (?, ?, ?, ?)`,
          [userId, card_id, is_visible, display_order]
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
 * 🔄 Reset to default preferences
 */
export const resetToDefaults = async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete existing preferences
    await dbHelpers.execute(
      `DELETE FROM user_dashboard_preferences WHERE user_id = ?`,
      [userId]
    );

    // Get default cards
    const defaultCards = await dbHelpers.query(
      `SELECT id, default_visible, display_order
       FROM dashboard_cards
       ORDER BY display_order ASC`
    );

    // Insert default preferences
    for (const card of defaultCards) {
      await dbHelpers.execute(
        `INSERT INTO user_dashboard_preferences (user_id, card_id, is_visible, display_order)
         VALUES (?, ?, ?, ?)`,
        [userId, card.id, card.default_visible, card.display_order]
      );
    }

    res.json({
      success: true,
      message: "Preferensi card berhasil direset ke default",
    });
  } catch (error) {
    console.error("❌ Reset to defaults error:", error);
    res.status(500).json({ error: "Gagal mereset preferensi card" });
  }
};
