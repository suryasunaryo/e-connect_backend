import { dbHelpers } from "../config/database.js";
import { emitDataChange } from "../utils/socketHelpers.js";

/**
 * GET ALL USER ROLES
 */
export const getAllUserRoles = async (req, res) => {
  try {
    const roles = await dbHelpers.query(
      "SELECT * FROM users_role WHERE deleted_at IS NULL ORDER BY role_id ASC",
    );

    res.json(roles);
  } catch (error) {
    console.error("❌ Error fetching user roles:", error);
    res.status(500).json({ error: "Failed to fetch user roles" });
  }
};

/**
 * GET SINGLE USER ROLE
 */
export const getUserRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await dbHelpers.queryOne(
      "SELECT * FROM users_role WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!role) {
      return res.status(404).json({ error: "User role not found" });
    }

    res.json(role);
  } catch (error) {
    console.error("❌ Error fetching user role:", error);
    res.status(500).json({ error: "Failed to fetch user role" });
  }
};

/**
 * CREATE USER ROLE
 */
export const createUserRole = async (req, res) => {
  try {
    let {
      role_id,
      role_name,
      menu_groups,
      menu_access,
      menu_permissions,
      is_active,
    } = req.body;

    // Validation
    if (!role_name) {
      return res.status(400).json({
        error: "Role Name is required",
      });
    }

    // Auto-generate role_id if not provided
    if (!role_id) {
      const maxRole = await dbHelpers.queryOne(
        "SELECT MAX(CAST(role_id AS UNSIGNED)) as max_id FROM users_role WHERE deleted_at IS NULL",
      );
      const nextId = (maxRole?.max_id || 0) + 1;
      role_id = nextId.toString();
    } else {
      // Check if role_id already exists
      const existingRole = await dbHelpers.queryOne(
        "SELECT id FROM users_role WHERE role_id = ? AND deleted_at IS NULL",
        [role_id],
      );

      if (existingRole) {
        return res.status(400).json({
          error: "Role ID already exists",
        });
      }
    }

    // Insert new role
    const result = await dbHelpers.execute(
      `INSERT INTO users_role (role_id, role_name, menu_groups, menu_access, menu_permissions, is_active) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        role_id,
        role_name,
        menu_groups || null,
        menu_access || null,
        menu_permissions
          ? typeof menu_permissions === "object"
            ? JSON.stringify(menu_permissions)
            : menu_permissions
          : null,
        is_active !== undefined ? is_active : 1,
      ],
    );

    const newRole = await dbHelpers.queryOne(
      "SELECT * FROM users_role WHERE id = ?",
      [result.insertId],
    );

    res.status(201).json({
      success: true,
      message: "User role created successfully",
      data: newRole,
    });
  } catch (error) {
    console.error("❌ Error creating user role:", error);
    res.status(500).json({ error: "Failed to create user role" });
  }
};

/**
 * UPDATE USER ROLE
 */
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      role_id,
      role_name,
      menu_groups,
      menu_access,
      menu_permissions,
      is_active,
    } = req.body;

    // Check if role exists
    const existing = await dbHelpers.queryOne(
      "SELECT * FROM users_role WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!existing) {
      return res.status(404).json({ error: "User role not found" });
    }

    // Validation
    if (!role_name) {
      return res.status(400).json({
        error: "Role Name is required",
      });
    }

    // Check if role_id already exists (excluding current role)
    if (role_id && role_id !== existing.role_id) {
      const duplicateRole = await dbHelpers.queryOne(
        "SELECT id FROM users_role WHERE role_id = ? AND id != ? AND deleted_at IS NULL",
        [role_id, id],
      );

      if (duplicateRole) {
        return res.status(400).json({
          error: "Role ID already exists",
        });
      }
    }

    // Update role
    await dbHelpers.execute(
      `UPDATE users_role 
       SET role_id = ?, role_name = ?, menu_groups = ?, menu_access = ?, menu_permissions = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [
        role_id || existing.role_id,
        role_name,
        menu_groups !== undefined ? menu_groups : existing.menu_groups,
        menu_access !== undefined ? menu_access : existing.menu_access,
        menu_permissions !== undefined
          ? typeof menu_permissions === "object"
            ? JSON.stringify(menu_permissions)
            : menu_permissions
          : existing.menu_permissions,
        is_active !== undefined ? is_active : existing.is_active,
        id,
      ],
    );

    const updatedRole = await dbHelpers.queryOne(
      "SELECT * FROM users_role WHERE id = ?",
      [id],
    );

    res.json({
      success: true,
      message: "User role updated successfully",
      data: updatedRole,
    });
  } catch (error) {
    console.error("❌ Error updating user role:", error);
    res.status(500).json({ error: "Failed to update user role" });
  }
};

/**
 * DELETE USER ROLE (SOFT DELETE)
 */
export const deleteUserRole = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if role exists
    const existing = await dbHelpers.queryOne(
      "SELECT * FROM users_role WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!existing) {
      return res.status(404).json({ error: "User role not found" });
    }

    // Soft delete
    await dbHelpers.execute(
      "UPDATE users_role SET deleted_at = CURRENT_TIMESTAMP, is_deleted = 1 WHERE id = ?",
      [id],
    );

    res.json({
      success: true,
      message: "User role deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting user role:", error);
    res.status(500).json({ error: "Failed to delete user role" });
  }
};
/**
 * AUTO FILL USER ROLES
 * Updates empty fields in users_role with provided values
 */
export const autoFillRoles = async (req, res) => {
  try {
    const { menu_groups, menu_access, menu_permissions, is_active } = req.body;

    // Execute update query
    // We use COALESCE/IFNULL equivalent logic: only update if the current value is NULL or empty string
    const result = await dbHelpers.execute(
      `UPDATE users_role 
       SET 
         menu_groups = CASE WHEN (menu_groups IS NULL OR menu_groups = '') THEN ? ELSE menu_groups END,
         menu_access = CASE WHEN (menu_access IS NULL OR menu_access = '') THEN ? ELSE menu_access END,
         menu_permissions = CASE WHEN (menu_permissions IS NULL OR menu_permissions = '') THEN ? ELSE menu_permissions END,
         is_active = CASE WHEN (is_active IS NULL) THEN ? ELSE is_active END,
         updated_at = CURRENT_TIMESTAMP
       WHERE deleted_at IS NULL`,
      [
        menu_groups || null,
        menu_access || null,
        menu_permissions
          ? typeof menu_permissions === "object"
            ? JSON.stringify(menu_permissions)
            : menu_permissions
          : null,
        is_active !== undefined ? is_active : 1,
      ],
    );

    res.json({
      success: true,
      message: `${result.affectedRows} roles updated successfully`,
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("❌ Error auto-filling user roles:", error);
    res.status(500).json({ error: "Failed to auto-fill user roles" });
  }
};

/**
 * SYNC USERS WITH ROLE
 * Updates all users belonging to this role with newest role permissions
 */
export const syncUsersWithRole = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get role details
    const role = await dbHelpers.queryOne(
      "SELECT * FROM users_role WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    // 2. Update all users with this role_id
    // Note: users table uses 'role' field which corresponds to 'role_id' in users_role
    const result = await dbHelpers.execute(
      `UPDATE users 
       SET menu_groups = ?, menu_access = ?, menu_permissions = ?
       WHERE role = ?`,
      [role.menu_groups, role.menu_access, role.menu_permissions, role.role_id],
    );

    emitDataChange("users", "update", { roleSync: role.role_id });

    res.json({
      success: true,
      message: `Successfully synchronized ${result.affectedRows} users with role ${role.role_name}`,
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("❌ Error syncing users with role:", error);
    res.status(500).json({
      error: "Failed to sync users with role",
      details: error.message,
      stack: error.stack,
    });
  }
};

/**
 * GET USERS WITH ROLE
 * Returns a list of users who have this role
 */
export const getUsersWithRole = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get role details
    const role = await dbHelpers.queryOne(
      "SELECT role_id FROM users_role WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    // 2. Get users with this role_id
    const users = await dbHelpers.query(
      "SELECT id, username, full_name FROM users WHERE role = ?",
      [role.role_id],
    );

    res.json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    console.error("❌ Error fetching users with role:", error);
    res.status(500).json({ error: "Failed to fetch users with role" });
  }
};
