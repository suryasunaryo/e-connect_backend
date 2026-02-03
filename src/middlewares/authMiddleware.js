import jwt from "jsonwebtoken";
import { dbHelpers } from "../config/database.js";

export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Update activity
    if (decoded.id) {
      dbHelpers
        .execute(
          "UPDATE users SET last_activity = NOW(), is_online = 1 WHERE id = ?",
          [decoded.id],
        )
        .catch((err) => console.error("❌ Failed to update activity:", err));
    }

    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};
