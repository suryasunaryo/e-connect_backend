import { dbHelpers } from "../config/database.js";
import { activityLogService } from "../services/activityLogService.js";
import { emitDataChange } from "../utils/socketHelpers.js";

export const getAllBanners = async (req, res) => {
  try {
    const sql = `
      SELECT b.*, IFNULL(u.full_name, u.username) as creator_name
      FROM banners b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.is_deleted = 0
      ORDER BY b.priority DESC, b.created_at DESC
    `;
    const banners = await dbHelpers.query(sql);
    res.json({ success: true, data: banners });
  } catch (error) {
    console.error("❌ Get all banners error:", error);
    res.status(500).json({ error: "Failed to fetch banners" });
  }
};

export const getBannerById = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT b.*, IFNULL(u.full_name, u.username) as creator_name
      FROM banners b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.id = ? AND b.is_deleted = 0
    `;
    const banner = await dbHelpers.query(sql, [id]);
    if (banner.length === 0) {
      return res.status(404).json({ error: "Banner not found" });
    }
    res.json({ success: true, data: banner[0] });
  } catch (error) {
    console.error("❌ Get banner by id error:", error);
    res.status(500).json({ error: "Failed to fetch banner" });
  }
};

export const createBanner = async (req, res) => {
  try {
    const { title, description, link_url, priority, is_active, show_text } =
      req.body;
    let banner_image = null;

    if (req.file) {
      banner_image = `/uploads/banners/${req.file.filename}`;
    }

    const sql = `
      INSERT INTO banners (title, description, banner_image, link_url, priority, is_active, show_text, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await dbHelpers.query(sql, [
      title,
      description,
      banner_image,
      link_url,
      priority || 0,
      is_active === undefined ? 1 : is_active,
      show_text === undefined ? 1 : show_text,
      req.user.id,
    ]);

    const newId = result.insertId;

    await activityLogService.logActivity({
      user_id: req.user.id,
      action: "CREATE",
      table_name: "banners",
      record_id: newId,
      new_values: {
        title,
        description,
        banner_image,
        link_url,
        priority,
        is_active,
        show_text,
      },
      description: `Created new banner: ${title}`,
      ip_address: activityLogService.getClientIp(req),
      user_agent: activityLogService.getUserAgent(req),
    });

    // Emit real-time update
    emitDataChange("banners", "create", { id: newId, title });

    res.json({
      success: true,
      id: newId,
      message: "Banner created successfully",
    });
  } catch (error) {
    console.error("❌ Create banner error:", error);
    res.status(500).json({ error: "Failed to create banner" });
  }
};

export const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, link_url, priority, is_active, show_text } =
      req.body;

    // Get old values for logging
    const oldBanner = await dbHelpers.query(
      "SELECT * FROM banners WHERE id = ?",
      [id],
    );
    if (oldBanner.length === 0) {
      return res.status(404).json({ error: "Banner not found" });
    }

    let banner_image = oldBanner[0].banner_image;
    if (req.file) {
      banner_image = `/uploads/banners/${req.file.filename}`;
    } else if (req.body.banner_image === "") {
      banner_image = null;
    }

    const sql = `
      UPDATE banners 
      SET title = ?, description = ?, banner_image = ?, link_url = ?, priority = ?, is_active = ?, show_text = ?
      WHERE id = ?
    `;
    await dbHelpers.query(sql, [
      title,
      description,
      banner_image,
      link_url,
      priority || 0,
      is_active,
      show_text,
      id,
    ]);

    await activityLogService.logActivity({
      user_id: req.user.id,
      action: "UPDATE",
      table_name: "banners",
      record_id: id,
      old_values: oldBanner[0],
      new_values: {
        title,
        description,
        banner_image,
        link_url,
        priority,
        is_active,
        show_text,
      },
      description: `Updated banner: ${title}`,
      ip_address: activityLogService.getClientIp(req),
      user_agent: activityLogService.getUserAgent(req),
    });

    // Emit real-time update
    emitDataChange("banners", "update", { id, title });

    res.json({ success: true, message: "Banner updated successfully" });
  } catch (error) {
    console.error("❌ Update banner error:", error);
    res.status(500).json({ error: "Failed to update banner" });
  }
};

export const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete
    const sql =
      "UPDATE banners SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?";
    await dbHelpers.query(sql, [id]);

    await activityLogService.logActivity({
      user_id: req.user.id,
      action: "DELETE",
      table_name: "banners",
      record_id: id,
      description: `Soft deleted banner ID: ${id}`,
      ip_address: activityLogService.getClientIp(req),
      user_agent: activityLogService.getUserAgent(req),
    });

    // Emit real-time update
    emitDataChange("banners", "delete", { id });

    res.json({ success: true, message: "Banner deleted successfully" });
  } catch (error) {
    console.error("❌ Delete banner error:", error);
    res.status(500).json({ error: "Failed to delete banner" });
  }
};
