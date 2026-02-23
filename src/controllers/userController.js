import bcrypt from "bcryptjs";
import { dbHelpers } from "../config/database.js";
import { emitDataChange } from "../utils/socketHelpers.js";

/**
 * 🧩 Fungsi Helper
 */
const hashPassword = (password) => bcrypt.hashSync(password, 10);

/**
 * 🧱 Get semua user
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await dbHelpers.query(
      "SELECT id, username, role, menu_groups, menu_access, menu_permissions, full_name, email, phone, is_active, is_online, last_activity, last_login, login_attempts, locked_until, bypass_face_detection FROM users ORDER BY id DESC",
    );
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("❌ Get users error:", error);
    res.status(500).json({ error: "Gagal mengambil data user" });
  }
};

/**
 * 👤 Get user by ID
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await dbHelpers.queryOne(
      "SELECT id, username, role, menu_groups, menu_access, menu_permissions, full_name, email, phone, is_active, is_online, last_activity, last_login, login_attempts, locked_until, bypass_face_detection FROM users WHERE id = ?",
      [id],
    );
    if (!user) return res.status(404).json({ error: "User tidak ditemukan" });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil user" });
  }
};

/**
 * ➕ Tambah user baru
 */
/**
 * ➕ Tambah user baru
 */
/**
 * ➕ Tambah user baru
 */
export const createUser = async (req, res) => {
  try {
    const { username, password, role, full_name, email, phone, is_active } =
      req.body;

    if (!username || !password || !role) {
      return res
        .status(400)
        .json({ error: "Username, password, dan role wajib diisi" });
    }

    const existing = await dbHelpers.queryOne(
      "SELECT id FROM users WHERE username = ?",
      [username],
    );
    if (existing)
      return res.status(400).json({ error: "Username sudah digunakan" });

    // Determine permissions: use request body if provided, otherwise fetch from role
    let menu_groups = req.body.menu_groups;
    let menu_access = req.body.menu_access;
    let menu_permissions = req.body.menu_permissions;

    if (
      menu_groups === undefined ||
      menu_access === undefined ||
      menu_permissions === undefined
    ) {
      const roleData = await dbHelpers.queryOne(
        "SELECT menu_groups, menu_access, menu_permissions FROM users_role WHERE role_id = ? AND deleted_at IS NULL",
        [role],
      );
      if (roleData) {
        if (menu_groups === undefined) menu_groups = roleData.menu_groups;
        if (menu_access === undefined) menu_access = roleData.menu_access;
        if (menu_permissions === undefined)
          menu_permissions = roleData.menu_permissions;
      }
    }

    // Ensure menu_permissions is a string (JSON) for DB storage if it's an object/array
    const permissionsJson =
      typeof menu_permissions === "object"
        ? JSON.stringify(menu_permissions)
        : menu_permissions;

    const hashed = hashPassword(password);
    await dbHelpers.execute(
      `INSERT INTO users (username, password, role, menu_groups, menu_access, menu_permissions, full_name, email, phone, is_active, bypass_face_detection)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        hashed,
        role,
        menu_groups || null,
        menu_access || null,
        permissionsJson || null,
        full_name || "",
        email || "",
        phone || "",
        is_active ?? true,
        0, // Default to 0 (ON) for new users
      ],
    );

    const newUser = {
      username,
      role,
      full_name,
      email,
      phone,
      is_active: is_active ?? true,
    };
    emitDataChange("users", "create", newUser);

    res.json({ success: true, message: "User berhasil ditambahkan" });
  } catch (error) {
    console.error("❌ Create user error:", error);
    res.status(500).json({ error: "Gagal menambahkan user" });
  }
};

/**
 * ✏️ Update user
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, full_name, email, phone, is_active } = req.body;

    let menu_groups = req.body.menu_groups;
    let menu_access = req.body.menu_access;
    let menu_permissions = req.body.menu_permissions;

    // Only fetch from role if permissions are NOT provided and role IS provided
    if (
      role &&
      (menu_groups === undefined ||
        menu_access === undefined ||
        menu_permissions === undefined)
    ) {
      const roleData = await dbHelpers.queryOne(
        "SELECT menu_groups, menu_access, menu_permissions FROM users_role WHERE role_id = ? AND deleted_at IS NULL",
        [role],
      );
      if (roleData) {
        if (menu_groups === undefined) menu_groups = roleData.menu_groups;
        if (menu_access === undefined) menu_access = roleData.menu_access;
        if (menu_permissions === undefined)
          menu_permissions = roleData.menu_permissions;
      }
    }

    const permissionsJson =
      typeof menu_permissions === "object"
        ? JSON.stringify(menu_permissions)
        : menu_permissions;

    await dbHelpers.execute(
      `UPDATE users SET role=?, menu_groups=?, menu_access=?, menu_permissions=?, full_name=?, email=?, phone=?, is_active=? WHERE id=?`,
      [
        role,
        menu_groups,
        menu_access,
        permissionsJson,
        full_name,
        email,
        phone,
        is_active,
        id,
      ],
    );

    emitDataChange("users", "update", {
      id,
      role,
      full_name,
      email,
      phone,
      is_active,
    });

    res.json({ success: true, message: "User berhasil diperbarui" });
  } catch (error) {
    console.error("❌ Update user error:", error);
    res.status(500).json({ error: "Gagal memperbarui user" });
  }
};

/**
 * 🔒 Lock / Unlock user
 */
/**
 * 🔒 Lock / Unlock user
 */
export const toggleLockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { lock, lockedUntil } = req.body;

    let lockDate = null;
    if (lock) {
      // Use provided date or default to 1 hour if not provided
      lockDate = lockedUntil
        ? new Date(lockedUntil)
        : new Date(Date.now() + 60 * 60 * 1000);
    }

    await dbHelpers.execute(
      "UPDATE users SET locked_until = ?, login_attempts = 0 WHERE id = ?",
      [lockDate, id],
    );

    emitDataChange("users", "update", {
      id,
      lockedUntil: lockDate,
      isLocked: lock,
    });

    res.json({
      success: true,
      message: lock ? "User berhasil dikunci" : "User berhasil dibuka",
    });
  } catch (error) {
    console.error("❌ Lock user error:", error);
    res.status(500).json({ error: "Gagal mengubah status lock user" });
  }
};

/**
 * 🔑 Ubah password user
 */
export const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword)
      return res.status(400).json({ error: "Password baru wajib diisi" });

    const hashed = hashPassword(newPassword);
    await dbHelpers.execute("UPDATE users SET password=? WHERE id=?", [
      hashed,
      id,
    ]);

    emitDataChange("users", "update", { id }); // Don't emit password

    res.json({ success: true, message: "Password berhasil diubah" });
  } catch (error) {
    console.error("❌ Change password error:", error);
    res.status(500).json({ error: "Gagal mengubah password" });
  }
};

/**
 * 🧼 Reset login attempts
 */
export const resetLoginAttempts = async (req, res) => {
  try {
    const { id } = req.params;
    await dbHelpers.execute(
      "UPDATE users SET login_attempts=0, locked_until=NULL WHERE id=?",
      [id],
    );
    res.json({ success: true, message: "Login attempts berhasil direset" });
  } catch (error) {
    res.status(500).json({ error: "Gagal mereset login attempts" });
  }
};

/**
 * 🟢 Get active users (online or active in last 10 mins)
 */
export const getActiveUsers = async (req, res) => {
  try {
    // Users who are either explicitly marked is_online = 1
    // OR have had activity in the last 10 minutes
    const users = await dbHelpers.query(
      `SELECT id, username, full_name, role, is_online, last_activity, last_login 
       FROM users 
       WHERE (is_online = 1 OR last_activity > DATE_SUB(NOW(), INTERVAL 10 MINUTE))
       AND is_active = TRUE
       ORDER BY last_activity DESC`,
    );
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("❌ Get active users error:", error);
    res.status(500).json({ error: "Gagal mengambil data user aktif" });
  }
};

/**
 * ❌ Hapus user
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Start transaction
    const pool = await dbHelpers.getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Clear user_id from employees table first
      await connection.query(
        "UPDATE employees SET user_id = NULL WHERE user_id = ? OR nik = (SELECT username FROM users WHERE id = ?)",
        [id, id],
      );

      // Delete user
      await connection.query("DELETE FROM users WHERE id=?", [id]);

      await connection.commit();
      connection.release();

      emitDataChange("users", "delete", { id });

      res.json({ success: true, message: "User berhasil dihapus" });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("❌ Delete user error:", error);
    res.status(500).json({ error: "Gagal menghapus user" });
  }
};
