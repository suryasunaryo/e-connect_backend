import express from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearHistory,
} from "../controllers/notificationController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/", getNotifications);
router.put("/:id/read", markAsRead);
router.put("/read-all", markAllAsRead);
router.delete("/clear-history", clearHistory);

export default router;
