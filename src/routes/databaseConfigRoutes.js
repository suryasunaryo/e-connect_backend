import express from "express";
import * as dbConfigController from "../controllers/databaseConfigController.js";
import { authenticateToken } from "../middleware/auth.js";
import { activityLogger } from "../middleware/activityLogger.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Saved Queries (Specific routes first)
router.get("/saved-queries", dbConfigController.getAllSavedQueriesManagement);
router.get("/saved-queries/:id/preview", dbConfigController.previewSavedQuery);
router.post("/saved-queries", dbConfigController.saveQuery);
router.put("/saved-queries/:id", dbConfigController.updateSavedQuery);
router.delete("/saved-queries/:id", dbConfigController.deleteSavedQuery);

// Connection routes
router.get("/", dbConfigController.getAllConnections);
router.post(
  "/",
  activityLogger.logModuleActivity("database_connections", "CREATE"),
  dbConfigController.createConnection,
);
router.post("/test", dbConfigController.testConnection);
router.post("/discover-databases", dbConfigController.discoverDatabases);

// Connection-specific routes (Parameterized routes last)
router.get("/:id", dbConfigController.getConnection);
router.put(
  "/:id",
  activityLogger.logModuleActivity("database_connections", "UPDATE"),
  dbConfigController.updateConnection,
);
router.get("/:id/tables", dbConfigController.getTables);
router.post(
  "/:id/query",
  activityLogger.logModuleActivity("database_connections", "QUERY"),
  dbConfigController.executeQuery,
);
router.get("/:id/saved-queries", dbConfigController.getSavedQueries);
router.delete(
  "/:id",
  activityLogger.logModuleActivity("database_connections", "DELETE"),
  dbConfigController.deleteConnection,
);

export default router;
