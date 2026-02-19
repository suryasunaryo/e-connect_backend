import { dbHelpers, createUploadFolder } from "../config/database.js";
import { emitDataChange } from "../utils/socketHelpers.js";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// Helper to get employee data for targeting
const getUserEmployeeData = async (userId) => {
  const employee = await dbHelpers.queryOne(
    `SELECT id, department_id, branch_id, position_id 
     FROM employees 
     WHERE user_id = ? AND deleted_at IS NULL`,
    [userId],
  );
  return employee || {};
};

/**
 * 🔔 HELPER: Create targeted notifications for news publication
 */
const createNewsNotifications = async (newsId, title, targets) => {
  try {
    const { createNotification } = await import("./notificationController.js");

    let parsedTargets = [];
    if (targets) {
      parsedTargets =
        typeof targets === "string" ? JSON.parse(targets) : targets;
    }

    const notifBase = {
      type: "info",
      title: "Berita Baru Dibuat",
      message: `${title}`,
      link: `/news/${newsId}`,
      item_type: "news",
      item_id: newsId,
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

    if (parsedTargets.length === 0) {
      // Default to broadcast if no targets (legacy support)
      await createNotification({ ...notifBase, user_id: null });
    } else {
      let finalUserIds = new Set();
      let isBroadcast = false;

      for (const t of parsedTargets) {
        const uids = await resolveUsers(
          t.type || t.target_type,
          t.value || t.target_value,
        );
        if (uids === null) {
          isBroadcast = true;
          break;
        }
        uids.forEach((id) => finalUserIds.add(id));
      }

      if (isBroadcast) {
        await createNotification({ ...notifBase, user_id: null });
      } else {
        for (const uid of finalUserIds) {
          await createNotification({ ...notifBase, user_id: uid });
        }
      }
    }
  } catch (error) {
    console.error("❌ Error creating news notifications:", error);
  }
};

/**
 * 📝 CREATE NEWS
 * POST /api/news
 * Accepts multipart (files)
 */
export const createNews = async (req, res) => {
  try {
    const {
      title,
      content,
      category,
      publish_at,
      close_date,
      targets, // Expecting JSON string or array
      allow_comments,
      pin_top,
      priority,
      status,
    } = req.body;

    const userId = req.user.id; // From auth middleware

    const isDraft = status === "draft";
    if (!title || (!isDraft && (!content || !category))) {
      return res.status(400).json({
        error: "Title, content, and category are required for publishing",
      });
    }

    const newsId = uuidv4();

    // Handle Cover Image
    let coverImagePath = null;
    if (req.files && req.files["cover_image"] && req.files["cover_image"][0]) {
      const file = req.files["cover_image"][0];
      coverImagePath = `/${file.path.replace(/\\/g, "/")}`;
    }

    // Insert News
    console.log("📝 Inserting news into database...", { newsId, userId });
    try {
      await dbHelpers.execute(
        `INSERT INTO news 
        (id, title, content, category, created_by, publish_at, close_date, allow_comments, pin_top, priority, status, cover_image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newsId,
          title,
          content,
          category,
          userId,
          publish_at || null,
          close_date || null,
          allow_comments === "true" || allow_comments === true,
          pin_top === "true" || pin_top === true,
          priority || "normal",
          status || "draft",
          coverImagePath,
        ],
      );
    } catch (dbErr) {
      console.error("❌ SQL Error inserting news:", dbErr);
      throw dbErr; // Let the outer catch handle it
    }

    // 2. Handle Targets
    if (targets) {
      let parsedTargets = [];
      try {
        parsedTargets =
          typeof targets === "string" ? JSON.parse(targets) : targets;
      } catch (e) {
        console.error("❌ Error parsing targets:", e);
      }

      if (Array.isArray(parsedTargets)) {
        for (const t of parsedTargets) {
          await dbHelpers.execute(
            `INSERT INTO news_targets (news_id, target_type, target_value) VALUES (?, ?, ?)`,
            [
              newsId,
              t.type || t.target_type || "all",
              t.value || t.target_value || null,
            ],
          );
        }
      }
    }

    // 3. Handle Attachment Files
    if (req.files && req.files["files"] && req.files["files"].length > 0) {
      const files = req.files["files"];
      for (const file of files) {
        const type =
          file.mimetype && file.mimetype.startsWith("image/")
            ? "image"
            : "attachment";
        const filePath = `/${file.path.replace(/\\/g, "/")}`; // store with leading slash to allow static serving
        await dbHelpers.execute(
          `INSERT INTO news_files (news_id, file_path, file_name, file_type) VALUES (?, ?, ?, ?)`,
          [newsId, filePath, file.originalname, type],
        );
      }
    }

    emitDataChange("news", "create", { id: newsId });

    // 🔔 If published, create notifications
    if (status === "published") {
      await createNewsNotifications(newsId, title, targets);
    }

    res.json({ success: true, data: { id: newsId } });
  } catch (error) {
    console.error("❌ Create news error:", error);
    res.status(500).json({
      error: "Failed to create news",
      details: error.message,
      sqlMessage: error.sqlMessage,
    });
  }
};

/**
 * 📚 GET ALL NEWS
 * GET /api/news
 */
export const getAllNews = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, search, category } = req.query;

    // Basic filtering: published only for normal users unless they are creator/admin
    let condition = "WHERE n.deleted_at IS NULL";
    const params = [];

    if (status) {
      condition += " AND n.status = ?";
      params.push(status);
    } else {
      // Default: non-admin see published only
      if (!req.user || req.user.role !== "admin") {
        condition += " AND n.status = 'published'";
      }
    }

    // 🕒 Auto-close logic & Scheduled Post logic
    // Hidden from non-admins if close_date passed OR publish_at is in future
    if (!req.user || req.user.role !== "admin") {
      condition += ` AND (
        (n.close_date IS NULL OR n.close_date > CURRENT_TIMESTAMP)
        AND 
        (n.publish_at IS NULL OR n.publish_at <= CURRENT_TIMESTAMP)
      )`;
    }

    if (search) {
      condition += " AND (n.title LIKE ? OR n.content LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      condition += " AND n.category = ?";
      params.push(category);
    }

    // 🔍 Targeting Logic
    // If user is NOT admin, we must check if they are in the target audience
    if (req.user && req.user.role !== "admin") {
      const u = req.user;

      // 🚀 Fetch real employee data because it might not be in JWT
      const emp = await getUserEmployeeData(u.id);
      const uDept = String(emp.department_id || "");
      const uBranch = String(emp.branch_id || "");
      const uPos = String(emp.position_id || "");

      condition += ` AND (
        n.created_by = ? 
        OR NOT EXISTS (SELECT 1 FROM news_targets WHERE news_id = n.id)
        OR EXISTS (
          SELECT 1 FROM news_targets nt WHERE nt.news_id = n.id AND (
            (nt.target_type = 'all') OR
            (nt.target_type = 'user' AND FIND_IN_SET(?, nt.target_value)) OR
            (nt.target_type = 'department' AND FIND_IN_SET(?, nt.target_value)) OR
            (nt.target_type = 'branch' AND FIND_IN_SET(?, nt.target_value)) OR
            (nt.target_type = 'position' AND FIND_IN_SET(?, nt.target_value)) OR
            (nt.target_type = 'role' AND (FIND_IN_SET(?, nt.target_value) OR FIND_IN_SET(?, nt.target_value)))
          )
        )
      )`;

      // Add params for the checks
      params.push(u.id); // created_by
      params.push(String(u.id)); // user targeting
      params.push(uDept); // department targeting
      params.push(uBranch); // branch targeting
      params.push(uPos); // position targeting
      params.push(String(u.role_id || "")); // role by ID
      params.push(String(u.role || "")); // role by Name
    }

    const sql = `
      SELECT n.*, IFNULL(u.full_name, u.username) as creator_name,
        (SELECT COUNT(*) FROM news_read nr WHERE nr.news_id = n.id) as read_count
      FROM news n
      LEFT JOIN users u ON n.created_by = u.id
      ${condition}
      ORDER BY n.pin_top DESC, n.priority DESC, n.created_at DESC
      LIMIT 0, 200
    `;

    const rows = await dbHelpers.query(sql, params);

    // Fetch targets separately to avoid JSON_ARRAYAGG compatibility issues
    if (rows.length > 0) {
      const newsIds = rows.map((r) => r.id);
      const targets = await dbHelpers.query(
        `SELECT id, news_id, target_type, target_value FROM news_targets WHERE news_id IN (${newsIds.map(() => "?").join(",")})`,
        newsIds,
      );

      // Map targets to their respective news items
      rows.forEach((row) => {
        row.targets = targets.filter((t) => t.news_id === row.id);
      });
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Get all news error:", error);
    res.status(500).json({ error: "Failed to fetch news list" });
  }
};

/**
 * 📄 GET NEWS DETAIL
 * GET /api/news/:id
 */
export const getNewsById = async (req, res) => {
  try {
    const { id } = req.params;

    const news = await dbHelpers.queryOne(
      `SELECT n.*, IFNULL(u.full_name, u.username) as creator_name,
        (SELECT COUNT(*) FROM news_read nr WHERE nr.news_id = n.id) as read_count
       FROM news n
       LEFT JOIN users u ON n.created_by = u.id
       WHERE n.id = ? AND n.deleted_at IS NULL`,
      [id],
    );

    if (!news) return res.status(404).json({ error: "News not found" });

    const files = await dbHelpers.query(
      `SELECT * FROM news_files WHERE news_id = ? ORDER BY id ASC`,
      [id],
    );

    const targets = await dbHelpers.query(
      `SELECT * FROM news_targets WHERE news_id = ?`,
      [id],
    );

    res.json({ success: true, data: { news, files, targets } });
  } catch (error) {
    console.error("❌ Get news detail error:", error);
    res.status(500).json({ error: "Failed to fetch news detail" });
  }
};

/**
 * ✏️ UPDATE NEWS
 * PUT /api/news/:id
 * Handles: core fields, replace targets if provided, accept uploaded files
 */
export const updateNews = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      category,
      status,
      publish_at,
      close_date,
      allow_comments,
      pin_top,
      priority,
      targets, // optional: JSON string or array
    } = req.body;

    // Verify existence
    const existing = await dbHelpers.queryOne(
      "SELECT * FROM news WHERE id = ?",
      [id],
    );
    if (!existing) return res.status(404).json({ error: "News not found" });

    // 🔒 PERMISSION CHECK
    if (req.user.role !== "admin" && existing.created_by !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized to edit this news" });
    }

    const newStatus = status || existing.status;

    // Update core fields
    let coverImagePath = undefined;
    if (req.files && req.files["cover_image"] && req.files["cover_image"][0]) {
      const file = req.files["cover_image"][0];
      coverImagePath = `/${file.path.replace(/\\/g, "/")}`;
    }

    const updateParams = [
      title || existing.title,
      content || existing.content,
      category || existing.category,
      status || existing.status,
      publish_at || existing.publish_at,
      close_date !== undefined ? close_date || null : existing.close_date,
      allow_comments !== undefined
        ? allow_comments === "true" || allow_comments === true
        : existing.allow_comments,
      pin_top !== undefined
        ? pin_top === "true" || pin_top === true
        : existing.pin_top,
      priority || existing.priority,
    ];

    // If cover image is updated, include it
    let sql = `UPDATE news SET 
       title=?, content=?, category=?, status=?, publish_at=?, close_date=?, 
       allow_comments=?, pin_top=?, priority=?`;

    if (coverImagePath !== undefined) {
      sql += `, cover_image=?`;
      updateParams.push(coverImagePath);
    }

    sql += `, updated_at=CURRENT_TIMESTAMP`;
    if (newStatus === "published" && existing.status !== "published") {
      sql += `, created_at=CURRENT_TIMESTAMP`;
    }
    sql += ` WHERE id=?`;
    updateParams.push(id);

    await dbHelpers.execute(sql, updateParams);

    // Replace targets if provided
    if (targets) {
      let parsedTargets = [];
      try {
        parsedTargets =
          typeof targets === "string" ? JSON.parse(targets) : targets;
      } catch (e) {
        console.warn("Failed parse targets on update:", e);
      }

      await dbHelpers.execute(`DELETE FROM news_targets WHERE news_id = ?`, [
        id,
      ]);

      if (Array.isArray(parsedTargets)) {
        for (const t of parsedTargets) {
          await dbHelpers.execute(
            `INSERT INTO news_targets (news_id, target_type, target_value) VALUES (?, ?, ?)`,
            [
              id,
              t.type || t.target_type || "all",
              t.value || t.target_value || null,
            ],
          );
        }
      }
    }

    // Handle uploaded attachment files (req.files['files']) on edit
    if (req.files && req.files["files"] && req.files["files"].length > 0) {
      const files = req.files["files"];
      for (const file of files) {
        const type =
          file.mimetype && file.mimetype.startsWith("image/")
            ? "image"
            : "attachment";
        const filePath = `/${file.path.replace(/\\/g, "/")}`;
        await dbHelpers.execute(
          `INSERT INTO news_files (news_id, file_path, file_name, file_type) VALUES (?, ?, ?, ?)`,
          [id, filePath, file.originalname, type],
        );
      }
    }

    emitDataChange("news", "update", { id });

    // 🔔 Notify if transitioning from draft/archived to published
    if (newStatus === "published" && existing.status !== "published") {
      // We use the new title if provided, otherwise the existing one
      // We use the new targets if provided, otherwise fetch existing
      let targetSource = targets;
      if (!targetSource) {
        const existingTargets = await dbHelpers.query(
          `SELECT target_type as type, target_value as value FROM news_targets WHERE news_id = ?`,
          [id],
        );
        targetSource = existingTargets;
      }
      await createNewsNotifications(id, title || existing.title, targetSource);
    }

    res.json({ success: true, message: "News updated successfully" });
  } catch (error) {
    console.error("❌ Update news error:", error);
    res.status(500).json({
      error: "Failed to update news",
      details: error.message,
      sqlMessage: error.sqlMessage,
    });
  }
};

/**
 * 🗑 DELETE NEWS (Soft Delete)
 * DELETE /api/news/:id
 */
export const deleteNews = async (req, res) => {
  try {
    const { id } = req.params;

    // Check existence and permission
    const existing = await dbHelpers.queryOne(
      "SELECT * FROM news WHERE id = ?",
      [id],
    );
    if (!existing) return res.status(404).json({ error: "News not found" });

    // 🔒 PERMISSION CHECK
    if (req.user.role !== "admin" && existing.created_by !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Unauthorized to delete this news" });
    }

    await dbHelpers.execute(
      "UPDATE news SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id],
    );
    emitDataChange("news", "delete", { id });
    res.json({ success: true, message: "News deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete news" });
  }
};

/**
 * ✅ MARK AS READ
 * POST /api/news/:id/read
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await dbHelpers.execute(
      `INSERT IGNORE INTO news_read (news_id, user_id) VALUES (?, ?)`,
      [id, userId],
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
};

/**
 * 🗨 COMMENTS
 * GET /api/news/:id/comments
 * POST /api/news/:id/comments
 */
export const getCommentsForNews = async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await dbHelpers.query(
      `SELECT nc.*, IFNULL(u.full_name, u.username) as user_display_name, e.picture as user_picture
       FROM news_comments nc 
       LEFT JOIN users u ON nc.user_id = u.id 
       LEFT JOIN employees e ON u.id = e.user_id
       WHERE nc.news_id = ? 
       ORDER BY nc.created_at ASC`,
      [id],
    );
    res.json({ success: true, data: comments });
  } catch (err) {
    console.error("❌ Get comments error:", err);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
};

export const postCommentForNews = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { comment, parent_id } = req.body;

    if (!comment || comment.trim() === "") {
      return res.status(400).json({ error: "Comment cannot be empty" });
    }

    // check allow_comments and status
    const news = await dbHelpers.queryOne(
      `SELECT allow_comments, status FROM news WHERE id = ?`,
      [id],
    );
    if (!news) return res.status(404).json({ error: "News not found" });
    if (!news.allow_comments)
      return res.status(403).json({ error: "Comments disabled for this news" });
    if (news.status !== "published")
      return res
        .status(403)
        .json({ error: "Cannot comment on unpublished news" });

    await dbHelpers.execute(
      `INSERT INTO news_comments (news_id, user_id, comment, parent_id) VALUES (?, ?, ?, ?)`,
      [id, userId, comment, parent_id || null],
    );

    emitDataChange("news_comments", "create", { newsId: id, userId });
    emitDataChange("news", "update", { id }); // Comment count likely changed

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Post comment error:", err);
    res.status(500).json({ error: "Failed to post comment" });
  }
};

/**
 * 🗑 DELETE NEWS FILE
 * DELETE /api/news/files/:fileId
 */
export const deleteNewsFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    // 1. Get file details and check permission
    const file = await dbHelpers.queryOne(
      `SELECT nf.*, n.created_by 
       FROM news_files nf
       JOIN news n ON nf.news_id = n.id
       WHERE nf.id = ?`,
      [fileId],
    );

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Permission check: admin or news creator
    if (req.user.role !== "admin" && file.created_by !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Unauthorized to delete this file" });
    }

    // 2. Delete from database
    await dbHelpers.execute(`DELETE FROM news_files WHERE id = ?`, [fileId]);

    // 3. Delete from filesystem
    if (file.file_path) {
      // file_path stored as "/uploads/news/..."
      const fullPath = path.join(process.cwd(), file.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    emitDataChange("news", "update", { id: file.news_id });

    res.json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    console.error("❌ Delete news file error:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
};
