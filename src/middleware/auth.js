import jwt from "jsonwebtoken";
import { dbHelpers } from "../config/database.js";

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  // DEBUG LOG
  // console.log(`🔒 Auth Check: ${req.method} ${req.originalUrl}`);

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }

    req.user = user;

    // Update last_activity and ensure is_online=1
    try {
      if (user.id) {
        dbHelpers
          .execute(
            "UPDATE users SET last_activity = NOW(), is_online = 1 WHERE id = ?",
            [user.id],
          )
          .catch((err) =>
            console.error("❌ Failed to update last_activity:", err),
          );
      }
    } catch (e) {
      console.error("❌ Error updating user activity:", e);
    }

    next();
  });
};

export const requireAdmin = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "30")) {
    next();
  } else {
    res.status(403).json({ error: "Admin access required" });
  }
};
