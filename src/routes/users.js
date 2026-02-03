import express from "express";
import { requireAdmin, authenticateToken } from "../middleware/auth.js";
import { activityLogger } from "../middleware/activityLogger.js";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleLockUser,
  changePassword,
  resetLoginAttempts,
  getActiveUsers,
} from "../controllers/userController.js";

const router = express.Router();

// GET - dengan logging untuk detail
router.get("/active", authenticateToken, requireAdmin, getActiveUsers);
router.get("/", authenticateToken, getAllUsers);
router.get(
  "/:id",
  authenticateToken,
  requireAdmin,
  activityLogger.logUserActivity("READ"),
  getUserById,
);

// CREATE - catat semua field
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  activityLogger.logUserActivity("CREATE"),
  createUser,
);

// UPDATE - catat field yang berubah
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  activityLogger.logUserActivity("UPDATE"),
  updateUser,
);

// DELETE - soft delete
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  activityLogger.logUserActivity("DELETE"),
  deleteUser,
);

// OPERATIONS KHUSUS
router.patch(
  "/:id/lock",
  authenticateToken,
  requireAdmin,
  activityLogger.logUserActivity("UPDATE"),
  toggleLockUser,
);
router.patch(
  "/:id/password",
  authenticateToken,
  requireAdmin,
  activityLogger.logUserActivity("UPDATE"),
  changePassword,
);
router.patch(
  "/:id/reset-attempts",
  authenticateToken,
  requireAdmin,
  activityLogger.logUserActivity("UPDATE"),
  resetLoginAttempts,
);

export default router;
