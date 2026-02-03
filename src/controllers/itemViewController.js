import { dbHelpers } from "../config/database.js";

export const markAsViewed = async (req, res) => {
  const userId = req.user?.id;
  const { item_type, item_id } = req.body;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!item_type || !item_id)
    return res.status(400).json({ error: "Missing item_type or item_id" });

  try {
    await dbHelpers.execute(
      `
      INSERT IGNORE INTO user_item_views (user_id, item_type, item_id)
      VALUES (?, ?, ?)
    `,
      [userId, item_type, item_id],
    );

    res.json({ success: true, message: "Item marked as viewed" });
  } catch (error) {
    console.error("Error marking item as viewed:", error);
    res.status(500).json({ error: "Failed to mark item as viewed" });
  }
};

export const getViewedItems = async (req, res) => {
  const userId = req.user?.id;
  const { item_type } = req.query;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    let sql = "SELECT item_id FROM user_item_views WHERE user_id = ?";
    let params = [userId];

    if (item_type) {
      sql += " AND item_type = ?";
      params.push(item_type);
    }

    const rows = await dbHelpers.query(sql, params);
    const viewedIds = rows.map((r) => r.item_id);

    res.json({ success: true, data: viewedIds });
  } catch (error) {
    console.error("Error fetching viewed items:", error);
    res.status(500).json({ error: "Failed to fetch viewed items" });
  }
};
