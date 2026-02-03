import { dbHelpers } from "../config/database.js";
import { emitDataChange } from "../utils/socketHelpers.js";

export const getAllEventTypes = async (req, res) => {
  try {
    const { user_id } = req.query;

    let types = await dbHelpers.query(
      "SELECT * FROM calendar_event_types WHERE is_deleted = 0 ORDER BY category, name",
    );

    // Resolve auto_target_value to names for each type
    for (let type of types) {
      if (type.auto_target_type && type.auto_target_value) {
        const ids = type.auto_target_value.split(",").map((id) => id.trim());
        let names = [];

        try {
          switch (type.auto_target_type) {
            case "user":
            case "personal":
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
          console.error(`Error resolving names for ${type.auto_target_type}:`, err);
        }

        if (names.length > 0) {
          type.auto_target_names = names.join(", ");
        }
      }
    }

    // Filter by used_by if user_id is provided
    if (user_id) {
      const userId = parseInt(user_id);

      // Get user details for filtering - JOIN with employees & users_role
      const user = await dbHelpers.queryOne(
        `SELECT u.id, u.role, ur.role_name, e.department_id as dept_id, e.branch_id, e.position_id 
         FROM users u 
         LEFT JOIN employees e ON u.id = e.user_id 
         LEFT JOIN users_role ur ON u.role = ur.role_id
         WHERE u.id = ?`,
        [userId],
      );

      if (user) {
        // ADMIN and HR detection based on role name or specific role codes
        const roleName = (user.role_name || "").toLowerCase();
        const isAdminOrHR =
          user.role === "admin" ||
          roleName.includes("admin") ||
          roleName.includes("hr");

        if (!isAdminOrHR) {
          types = types.filter((type) => {
            // If no used_by restriction, show to all
            if (!type.used_by_type || type.used_by_type === "all") {
              return true;
            }

            const usedByValues = (type.used_by_value || "")
              .split(",")
              .filter(Boolean);

            switch (type.used_by_type) {
              case "user":
              case "personal":
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

    res.json({ success: true, data: types });
  } catch (error) {
    console.error("Error fetching event types:", error);
    res.status(500).json({ error: "Failed to fetch event types" });
  }
};

export const createEventType = async (req, res) => {
  const {
    code,
    name,
    category,
    color,
    description,
    auto_target_type,
    auto_target_value,
    used_by_type,
    used_by_value,
  } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: "Code and Name are required" });
  }

  try {
    const usedByType = used_by_type || null;
    const usedByValue = used_by_value || null;

    await dbHelpers.query(
      `INSERT INTO calendar_event_types 
      (code, name, category, color, description, auto_target_type, auto_target_value, used_by_type, used_by_value) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        name,
        category || "General",
        color || "#3B82F6",
        description || "",
        auto_target_type || null,
        auto_target_value || null,
        usedByType,
        usedByValue,
      ],
    );

    // Get the newly created object to emit full data
    const newType = await dbHelpers.queryOne(
      "SELECT * FROM calendar_event_types WHERE code = ? AND is_deleted = 0",
      [code],
    );

    emitDataChange("calendar_event_types", {
      action: "create",
      data: newType,
    });

    res.json({ success: true, message: "Event type created successfully" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Event type code already exists" });
    }
    console.error("Error creating event type:", error);
    res.status(500).json({ error: "Failed to create event type" });
  }
};

export const updateEventType = async (req, res) => {
  const { id } = req.params;

  const {
    name,
    category,
    color,
    description,
    auto_target_type,
    auto_target_value,
    used_by_type,
    used_by_value,
    is_active,
  } = req.body;

  try {
    const usedByType = used_by_type || null;
    const usedByValue = used_by_value || null;

    await dbHelpers.query(
      `UPDATE calendar_event_types 
       SET name = ?, category = ?, color = ?, description = ?, auto_target_type = ?, 
           auto_target_value = ?, used_by_type = ?, used_by_value = ?, is_active = ? 
       WHERE id = ?`,
      [
        name,
        category,
        color,
        description,
        auto_target_type || null,
        auto_target_value || null,
        usedByType,
        usedByValue,
        is_active,
        id,
      ],
    );

    // Get the updated object to emit full data
    const updatedType = await dbHelpers.queryOne(
      "SELECT * FROM calendar_event_types WHERE id = ?",
      [id],
    );

    emitDataChange("calendar_event_types", {
      action: "update",
      data: updatedType,
    });

    res.json({ success: true, message: "Event type updated successfully" });
  } catch (error) {
    console.error("Error updating event type:", error);
    res.status(500).json({
      error: "Failed to update event type",
      details: error.message,
      sqlMessage: error.sqlMessage,
    });
  }
};

export const deleteEventType = async (req, res) => {
  const { id } = req.params;
  try {
    // Check if event type exists and is already used
    const type = await dbHelpers.queryOne(
      "SELECT code, is_used FROM calendar_event_types WHERE id = ?",
      [id],
    );

    if (!type) {
      return res.status(404).json({ error: "Event type NOT found" });
    }

    if (type.is_used === 1) {
      return res.status(400).json({
        error: "Cannot delete event type because it has already been used",
      });
    }

    // Soft delete
    await dbHelpers.query(
      "UPDATE calendar_event_types SET is_deleted = 1, deleted_at = NOW() WHERE id = ?",
      [id],
    );

    emitDataChange("calendar_event_types", "delete", { id });

    res.json({ success: true, message: "Event type deleted successfully" });
  } catch (error) {
    console.error("Error deleting event type:", error);
    res.status(500).json({ error: "Failed to delete event type" });
  }
};
