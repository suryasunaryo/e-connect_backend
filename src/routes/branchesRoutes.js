import express from "express";
import {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
} from "../controllers/branchesController.js";
import { activityLogger } from "../middleware/activityLogger.js";

const router = express.Router();

// GET (no need log untuk list, but log untuk detail view)
router.get("/", getAllBranches);
router.get(
  "/:id",
  activityLogger.logModuleActivity("branches", "READ"),
  getBranchById
);

// CREATE - catat semua field
router.post(
  "/",
  activityLogger.logModuleActivity("branches", "CREATE"),
  createBranch
);

// UPDATE - catat field yang berubah
router.put(
  "/:id",
  activityLogger.logModuleActivity("branches", "UPDATE"),
  updateBranch
);

// DELETE - soft delete
router.delete(
  "/:id",
  activityLogger.logModuleActivity("branches", "DELETE"),
  deleteBranch
);

export default router;
