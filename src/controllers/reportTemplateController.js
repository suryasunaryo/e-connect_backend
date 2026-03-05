import { dbHelpers } from "../config/database.js";

const reportTemplateController = {
  /**
   * 📋 Get all report templates
   */
  getAllTemplates: async (req, res) => {
    try {
      const templates = await dbHelpers.query(
        "SELECT id, name, description, created_by, created_at, updated_at FROM report_templates WHERE is_deleted = 0 ORDER BY updated_at DESC",
      );
      res.json(templates);
    } catch (error) {
      console.error("❌ Get all templates error:", error);
      res.status(500).json({ error: "Failed to fetch report templates" });
    }
  },

  /**
   * 📄 Get template by ID (including config)
   */
  getTemplateById: async (req, res) => {
    const { id } = req.params;
    try {
      const template = await dbHelpers.queryOne(
        "SELECT * FROM report_templates WHERE id = ? AND is_deleted = 0",
        [id],
      );
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("❌ Get template by ID error:", error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  },

  /**
   * ✨ Create new report template
   */
  createTemplate: async (req, res) => {
    const { name, description, config } = req.body;
    const userId = req.user?.id || null;

    if (!name || !config) {
      return res.status(400).json({ error: "Name and config are required" });
    }

    try {
      const result = await dbHelpers.execute(
        "INSERT INTO report_templates (name, description, config, created_by) VALUES (?, ?, ?, ?)",
        [name, description, JSON.stringify(config), userId],
      );
      res.status(201).json({
        id: result.insertId,
        message: "Report template created successfully",
      });
    } catch (error) {
      console.error("❌ Create template error:", error);
      res.status(500).json({ error: "Failed to create report template" });
    }
  },

  /**
   * 🔄 Update existing report template
   */
  updateTemplate: async (req, res) => {
    const { id } = req.params;
    const { name, description, config } = req.body;

    try {
      const existing = await dbHelpers.queryOne(
        "SELECT id FROM report_templates WHERE id = ? AND is_deleted = 0",
        [id],
      );
      if (!existing) {
        return res.status(404).json({ error: "Template not found" });
      }

      const updates = [];
      const params = [];

      if (name !== undefined) {
        updates.push("name = ?");
        params.push(name);
      }
      if (description !== undefined) {
        updates.push("description = ?");
        params.push(description);
      }
      if (config !== undefined) {
        updates.push("config = ?");
        params.push(JSON.stringify(config));
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      params.push(id);
      await dbHelpers.execute(
        `UPDATE report_templates SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params,
      );

      res.json({ message: "Report template updated successfully" });
    } catch (error) {
      console.error("❌ Update template error:", error);
      res.status(500).json({ error: "Failed to update report template" });
    }
  },

  /**
   * 🗑️ Delete report template (Soft Delete)
   */
  deleteTemplate: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await dbHelpers.execute(
        "UPDATE report_templates SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id],
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json({ message: "Report template deleted successfully" });
    } catch (error) {
      console.error("❌ Delete template error:", error);
      res.status(500).json({ error: "Failed to delete report template" });
    }
  },
};

export default reportTemplateController;
