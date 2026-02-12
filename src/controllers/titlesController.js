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

/**
 * CREATE TITLE
 */
export const createTitle = async (req, res) => {
  try {
    const { name, level } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Title name is required" });
    }

    const result = await dbHelpers.execute(
      "INSERT INTO titles (title_name, title_level) VALUES (?, ?)",
      [name, level || null],
    );

    const newTitle = await dbHelpers.queryOne(
      "SELECT id, title_name as name, title_level as level FROM titles WHERE id = ?",
      [result.insertId],
    );

    res.status(201).json(newTitle);
  } catch (error) {
    console.error("❌ Error creating title:", error);
    res.status(500).json({ error: "Failed to create title" });
  }
};

/**
 * UPDATE TITLE
 */
export const updateTitle = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, level } = req.body;

    const existing = await dbHelpers.queryOne(
      "SELECT id FROM titles WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!existing) {
      return res.status(404).json({ error: "Title not found" });
    }

    await dbHelpers.execute(
      "UPDATE titles SET title_name = ?, title_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [name, level, id],
    );

    const updatedTitle = await dbHelpers.queryOne(
      "SELECT id, title_name as name, title_level as level FROM titles WHERE id = ?",
      [id],
    );

    res.json(updatedTitle);
  } catch (error) {
    console.error("❌ Error updating title:", error);
    res.status(500).json({ error: "Failed to update title" });
  }
};

/**
 * DELETE TITLE (SOFT DELETE)
 */
export const deleteTitle = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await dbHelpers.queryOne(
      "SELECT id FROM titles WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!existing) {
      return res.status(404).json({ error: "Title not found" });
    }

    await dbHelpers.execute(
      "UPDATE titles SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id],
    );

    res.json({ message: "Title deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting title:", error);
    res.status(500).json({ error: "Failed to delete title" });
  }
};
