// controllers/titlesController.js
import { dbHelpers } from "../config/database.js";

/**
 * GET ALL TITLES
 */
export const getAllTitles = async (req, res) => {
  try {
    const titles = await dbHelpers.query(`
      SELECT 
        id,
        title_name as name,
        title_level as level
      FROM titles 
      WHERE deleted_at IS NULL 
      ORDER BY title_name ASC
    `);
    res.json(titles);
  } catch (error) {
    console.error("❌ Error fetching titles:", error);
    res.status(500).json({ error: "Failed to fetch titles" });
  }
};
