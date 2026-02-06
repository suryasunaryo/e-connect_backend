import { dbHelpers } from "../config/database.js";
import { emitDataChange } from "../utils/socketHelpers.js";

/**
 * GET /api/user-favorites
 * Fetch all favorite apps for the logged-in user
 */
export const getUserFavorites = async (req, res) => {
  try {
    const userId = req.user.id;

    const favorites = await dbHelpers.query(
      `SELECT portal_app_id FROM user_favorite_apps WHERE user_id = ? ORDER BY created_at DESC`,
      [userId],
    );

    // Return array of portal_app_ids
    const favoriteIds = favorites.map((fav) => fav.portal_app_id);

    res.json({ success: true, data: favoriteIds });
  } catch (error) {
    console.error("Error fetching user favorites:", error);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
};

/**
 * POST /api/user-favorites
 * Add a new favorite app for the logged-in user
 */
export const addFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { portal_app_id } = req.body;

    if (!portal_app_id) {
      return res.status(400).json({ error: "portal_app_id is required" });
    }

    // Check if already favorited (will be caught by UNIQUE constraint, but we can check first)
    const existing = await dbHelpers.queryOne(
      `SELECT id FROM user_favorite_apps WHERE user_id = ? AND portal_app_id = ?`,
      [userId, portal_app_id],
    );

    if (existing) {
      return res.json({ success: true, message: "Already favorited" });
    }

    await dbHelpers.query(
      `INSERT INTO user_favorite_apps (user_id, portal_app_id) VALUES (?, ?)`,
      [userId, portal_app_id],
    );

    emitDataChange("user_favorites", "create", {
      user_id: userId,
      portal_app_id,
    });

    res.json({ success: true, message: "Favorite added" });
  } catch (error) {
    console.error("Error adding favorite:", error);
    res.status(500).json({ error: "Failed to add favorite" });
  }
};

/**
 * DELETE /api/user-favorites/:portal_app_id
 * Remove a favorite app for the logged-in user
 */
export const removeFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { portal_app_id } = req.params;

    if (!portal_app_id) {
      return res.status(400).json({ error: "portal_app_id is required" });
    }

    await dbHelpers.query(
      `DELETE FROM user_favorite_apps WHERE user_id = ? AND portal_app_id = ?`,
      [userId, portal_app_id],
    );

    emitDataChange("user_favorites", "delete", {
      user_id: userId,
      portal_app_id,
    });

    res.json({ success: true, message: "Favorite removed" });
  } catch (error) {
    console.error("Error removing favorite:", error);
    res.status(500).json({ error: "Failed to remove favorite" });
  }
};
