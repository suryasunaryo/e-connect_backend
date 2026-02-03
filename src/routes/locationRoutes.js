import express from "express";
import {
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
} from "../controllers/locationController.js";
import { activityLogger } from "../middleware/activityLogger.js";

const router = express.Router();

// GET
router.get("/", getAllLocations);
router.get(
  "/:id",
  activityLogger.logModuleActivity("locations", "READ"),
  getLocationById
);

// CREATE - catat semua field
router.post(
  "/",
  activityLogger.logModuleActivity("locations", "CREATE"),
  createLocation
);

// UPDATE - catat field yang berubah
router.put(
  "/:id",
  activityLogger.logModuleActivity("locations", "UPDATE"),
  updateLocation
);

// DELETE - soft delete
router.delete(
  "/:id",
  activityLogger.logModuleActivity("locations", "DELETE"),
  deleteLocation
);

export default router;
