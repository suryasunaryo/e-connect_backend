import { dbHelpers } from "../config/database.js";
import { emitDataChange } from "../utils/socketHelpers.js";

export const getNotifications = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Get all notifications relevant to this user
    // (either specific user_id or NULL for everyone)
    // Joined with notification_reads to see if they've read it
    const notifications = await dbHelpers.query(
      `
      SELECT 
        n.*, 
        (nr.id IS NOT NULL) as is_read
      FROM notifications n
      LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = ?
      WHERE (n.user_id IS NULL OR n.user_id = ?)
      AND (nr.is_hidden IS NULL OR nr.is_hidden = 0)
      ORDER BY n.created_at DESC
      LIMIT 100
    `,
      [userId, userId],
    );

    // Separate into present (unread) and history (read)
    const present = notifications.filter((n) => !n.is_read);
    const history = notifications.filter((n) => n.is_read);

    res.json({
      success: true,
      data: {
        present,
        history,
        unreadCount: present.length,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

export const markAsRead = async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params; // notification_id

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    await dbHelpers.execute(
      `
      INSERT IGNORE INTO notification_reads (notification_id, user_id)
      VALUES (?, ?)
    `,
      [id, userId],
    );

    // Emit socket event to notify other tabs/users that this notification state changed
    emitDataChange("notifications", "update", { id, userId, read: true });

    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to mark as read" });
  }
};

export const markAllAsRead = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Mark all unread notifications for this user as read
    await dbHelpers.execute(
      `
      INSERT IGNORE INTO notification_reads (notification_id, user_id)
      SELECT id, ? FROM notifications 
      WHERE (user_id IS NULL OR user_id = ?)
    `,
      [userId, userId],
    );

    // Emit socket event
    emitDataChange("notifications", "update", { userId, allRead: true });

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all as read:", error);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
};

export const clearHistory = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Hide all notifications that have been marked as read
    await dbHelpers.execute(
      `
      UPDATE notification_reads 
      SET is_hidden = 1 
      WHERE user_id = ? AND is_hidden = 0
    `,
      [userId],
    );

    // Emit socket event
    emitDataChange("notifications", "update", { userId, historyCleared: true });

    res.json({ success: true, message: "Notification history cleared" });
  } catch (error) {
    console.error("Error clearing history:", error);
    res.status(500).json({ error: "Failed to clear history" });
  }
};

/**
 * Utility function to create a notification (to be used by other controllers)
 */
export const createNotification = async (notifData) => {
  const { user_id, type, title, message, link, item_type, item_id } = notifData;
  try {
    const result = await dbHelpers.execute(
      `
      INSERT INTO notifications (user_id, type, title, message, link, item_type, item_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        user_id || null,
        type || "info",
        title,
        message,
        link || null,
        item_type || null,
        item_id || null,
      ],
    );

    console.log(
      `🔔 Notification created: id=${result.insertId}, user_id=${user_id || "broadcast"}`,
    );

    // Optional: Emit socket event to notify users in real-time
    // Since notifications can be broadcast, we could emit to a room or everyone
    // For now, let's just trigger a generic notification refresh event
    emitDataChange("notifications", "create", { id: result.insertId, user_id });

    return result.insertId;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};
