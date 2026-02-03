import express from "express";
import {
  getAllDepartements,
  getDepartementById,
  createDepartement,
  updateDepartement,
  deleteDepartement,
} from "../controllers/departementController.js";
import { activityLogger } from "../middleware/activityLogger.js";

const router = express.Router();

// GET all departments
router.get("/", getAllDepartements);

// GET department by ID
router.get(
  "/:id",
  activityLogger.logModuleActivity("departments", "READ"),
  getDepartementById
);

// CREATE new department
router.post(
  "/",
  activityLogger.logModuleActivity("departments", "CREATE"),
  createDepartement
);

// UPDATE department
router.put(
  "/:id",
  activityLogger.logModuleActivity("departments", "UPDATE"),
  updateDepartement
);

// DELETE department (soft delete)
router.delete(
  "/:id",
  activityLogger.logModuleActivity("departments", "DELETE"),
  deleteDepartement
);

export default router;
