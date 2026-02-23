import { dbHelpers } from "../config/database.js";
import { emitDataChange } from "../utils/socketHelpers.js";
import path from "path";
import fs from "fs";

export const getUploadFiles = async (req, res) => {
  try {
    const uploadsDir = path.join(process.cwd(), "uploads");

    if (!fs.existsSync(uploadsDir)) {
      return res.json({ success: true, data: [] });
    }

    const getAllFiles = (dirPath, arrayOfFiles = []) => {
      const files = fs.readdirSync(dirPath);

      files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
          arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
          // Store path relative to project root
          const relativePath =
            "/" + path.relative(process.cwd(), fullPath).replace(/\\/g, "/");
          arrayOfFiles.push({
            name: file,
            path: relativePath,
          });
        }
      });

      return arrayOfFiles;
    };

    const allFiles = getAllFiles(uploadsDir);
    res.json({ success: true, data: allFiles });
  } catch (error) {
    console.error("Error fetching upload files:", error);
    res.status(500).json({ error: "Failed to fetch files" });
  }
};

export const uploadPortalFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = `/${req.file.path.replace(/\\/g, "/")}`;
  res.json({ success: true, path: filePath });
};

export const deletePortalFile = async (req, res) => {
  const { path: filePath } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: "Path is required" });
  }

  // Security check: Only allow deleting files from uploads/portal_files/
  if (!filePath.startsWith("/uploads/portal_files/")) {
    return res.status(403).json({ error: "Unauthorized file deletion" });
  }

  const fullPath = path.join(process.cwd(), filePath);

  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      res.json({ success: true, message: "File deleted successfully" });
    } else {
      res.json({ success: true, message: "File already gone" });
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
};

export const getAllPortalSettings = async (req, res) => {
  try {
    const { user_id } = req.query;

    let settings = await dbHelpers.query(
      "SELECT * FROM portal_settings WHERE is_deleted = 0 ORDER BY category, portal_name",
    );

    // Resolve used_by_value to names
    for (let setting of settings) {
      if (setting.used_by_type && setting.used_by_value) {
        const ids = setting.used_by_value.split(",").map((id) => id.trim());
        let names = [];

        try {
          switch (setting.used_by_type) {
            case "user":
              const users = await dbHelpers.query(
                `SELECT full_name FROM users WHERE id IN (${ids.map(() => "?").join(",")})`,
                ids,
              );
              names = users.map((u) => u.full_name);
              break;
            case "department":
              const depts = await dbHelpers.query(
                `SELECT dept_name FROM departments WHERE id IN (${ids.map(() => "?").join(",")})`,
                ids,
              );
              names = depts.map((d) => d.dept_name);
              break;
            case "role":
              const roles = await dbHelpers.query(
                `SELECT role_name FROM users_role WHERE role_id IN (${ids.map(() => "?").join(",")})`,
                ids,
              );
              names = roles.map((r) => r.role_name);
              break;
            case "branch":
              const branches = await dbHelpers.query(
                `SELECT branch_name FROM branches WHERE id IN (${ids.map(() => "?").join(",")})`,
                ids,
              );
              names = branches.map((b) => b.branch_name);
              break;
            case "position":
              const positions = await dbHelpers.query(
                `SELECT position_name FROM positions WHERE id IN (${ids.map(() => "?").join(",")})`,
                ids,
              );
              names = positions.map((p) => p.position_name);
              break;
          }
        } catch (err) {
          console.error(
            `Error resolving names for ${setting.used_by_type}:`,
            err,
          );
        }

        if (names.length > 0) {
          setting.used_by_names = names.join(", ");
        }
      }
    }

    // Filter by used_by if user_id is provided (similar to Event Parameter logic)
    if (user_id) {
      const userId = parseInt(user_id);
      const user = await dbHelpers.queryOne(
        `SELECT u.id, u.role, ur.role_name, e.department_id as dept_id, e.branch_id, e.position_id 
         FROM users u 
         LEFT JOIN employees e ON (e.user_id = u.id OR e.nik = u.username) AND e.deleted_at IS NULL 
         LEFT JOIN users_role ur ON u.role = ur.role_id
         WHERE u.id = ?`,
        [userId],
      );

      if (user) {
        const roleName = (user.role_name || "").toLowerCase();
        const isAdminOrHR =
          user.role === "admin" ||
          roleName.includes("admin") ||
          roleName.includes("hr");

        if (!isAdminOrHR) {
          settings = settings.filter((setting) => {
            if (!setting.used_by_type || setting.used_by_type === "all")
              return true;

            const usedByValues = (setting.used_by_value || "")
              .split(",")
              .filter(Boolean);

            switch (setting.used_by_type) {
              case "user":
                return usedByValues.includes(userId.toString());
              case "department":
                return (
                  user.dept_id && usedByValues.includes(user.dept_id.toString())
                );
              case "role":
                return user.role && usedByValues.includes(user.role.toString());
              case "branch":
                return (
                  user.branch_id &&
                  usedByValues.includes(user.branch_id.toString())
                );
              case "position":
                return (
                  user.position_id &&
                  usedByValues.includes(user.position_id.toString())
                );
              default:
                return true;
            }
          });
        }
      }
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("Error fetching portal settings:", error);
    res.status(500).json({ error: "Failed to fetch portal settings" });
  }
};

export const createPortalSetting = async (req, res) => {
  let {
    portal_name,
    description,
    category,
    url,
    portal_image,
    used_by_type,
    used_by_value,
  } = req.body;

  // If a file was uploaded via multer, use that path
  if (req.file) {
    portal_image = `/${req.file.path.replace(/\\/g, "/")}`;
  }

  if (!portal_name) {
    return res.status(400).json({ error: "Portal name is required" });
  }

  try {
    const result = await dbHelpers.query(
      `INSERT INTO portal_settings 
      (portal_name, description, category, url, portal_image, used_by_type, used_by_value) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        portal_name,
        description || "",
        category || "General",
        url || "",
        portal_image || null,
        used_by_type || null,
        used_by_value || null,
      ],
    );

    const newSettingId = result.insertId;
    const newSetting = await dbHelpers.queryOne(
      "SELECT * FROM portal_settings WHERE id = ?",
      [newSettingId],
    );

    emitDataChange("portal_settings", "create", newSetting);

    res.json({
      success: true,
      message: "Portal setting created successfully",
      data: newSetting,
    });
  } catch (error) {
    console.error("Error creating portal setting:", error);
    res.status(500).json({ error: "Failed to create portal setting" });
  }
};

export const updatePortalSetting = async (req, res) => {
  const { id } = req.params;
  let {
    portal_name,
    description,
    category,
    url,
    portal_image,
    used_by_type,
    used_by_value,
    is_active,
  } = req.body;

  // If a file was uploaded via multer, use that path
  if (req.file) {
    portal_image = `/${req.file.path.replace(/\\/g, "/")}`;
  }

  try {
    await dbHelpers.query(
      `UPDATE portal_settings 
       SET portal_name = ?, description = ?, category = ?, url = ?, portal_image = ?, 
           used_by_type = ?, used_by_value = ?, is_active = ? 
       WHERE id = ?`,
      [
        portal_name,
        description,
        category,
        url,
        portal_image,
        used_by_type || null,
        used_by_value || null,
        is_active,
        id,
      ],
    );

    const updatedSetting = await dbHelpers.queryOne(
      "SELECT * FROM portal_settings WHERE id = ?",
      [id],
    );

    emitDataChange("portal_settings", "update", updatedSetting);

    res.json({
      success: true,
      message: "Portal setting updated successfully",
      data: updatedSetting,
    });
  } catch (error) {
    console.error("Error updating portal setting:", error);
    res.status(500).json({ error: "Failed to update portal setting" });
  }
};

export const deletePortalSetting = async (req, res) => {
  const { id } = req.params;
  try {
    const setting = await dbHelpers.queryOne(
      "SELECT id FROM portal_settings WHERE id = ?",
      [id],
    );

    if (!setting) {
      return res.status(404).json({ error: "Portal setting not found" });
    }

    // Soft delete
    await dbHelpers.query(
      "UPDATE portal_settings SET is_deleted = 1, deleted_at = NOW() WHERE id = ?",
      [id],
    );

    emitDataChange("portal_settings", "delete", { id });

    res.json({ success: true, message: "Portal setting deleted successfully" });
  } catch (error) {
    console.error("Error deleting portal setting:", error);
    res.status(500).json({ error: "Failed to delete portal setting" });
  }
};
