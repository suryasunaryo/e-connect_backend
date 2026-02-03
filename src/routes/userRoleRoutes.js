import express from "express";
import * as userRoleController from "../controllers/userRoleController.js";
import { authenticateToken } from "../middleware/auth.js";
import { activityLogger } from "../middleware/activityLogger.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/user-roles
 * Get all user roles
 */
router.get("/", userRoleController.getAllUserRoles);

/**
 * GET /api/user-roles/:id
 * Get single user role
 */
router.get(
  "/:id",
  activityLogger.logModuleActivity("users_role", "READ"),
  userRoleController.getUserRole,
);

/**
 * POST /api/user-roles
 * Create new user role
 */
router.post(
  "/",
  activityLogger.logModuleActivity("users_role", "CREATE"),
  userRoleController.createUserRole,
);

/**
 * PUT /api/user-roles/:id
 * Update user role
 */
router.put(
  "/:id",
  activityLogger.logModuleActivity("users_role", "UPDATE"),
  userRoleController.updateUserRole,
);

/**
 * DELETE /api/user-roles/:id
 * Soft delete user role
 */
router.delete(
  "/:id",
  activityLogger.logModuleActivity("users_role", "DELETE"),
  userRoleController.deleteUserRole,
);

/**
 * POST /api/user-roles/auto-fill
 * Auto fill empty roles
 */
router.post(
  "/auto-fill",
  activityLogger.logModuleActivity("users_role", "UPDATE"),
  userRoleController.autoFillRoles,
);

/**
 * POST /api/user-roles/:id/sync
 * Sync users with this role
 */
router.post(
  "/:id/sync",
  activityLogger.logModuleActivity("users_role", "UPDATE"),
  userRoleController.syncUsersWithRole,
);

/**
 * GET /api/user-roles/:id/users
 * Get users with this role
 */
router.get(
  "/:id/users",
  activityLogger.logModuleActivity("users_role", "READ"),
  userRoleController.getUsersWithRole,
);

export default router;
