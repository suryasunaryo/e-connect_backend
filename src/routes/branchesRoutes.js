import express from "express";
import {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
} from "../controllers/branchesController.js";
import { activityLogger } from "../middleware/activityLogger.js";

import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Multer Setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/branches/";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// GET (no need log untuk list, but log untuk detail view)
router.get("/", getAllBranches);
router.get(
  "/:id",
  activityLogger.logModuleActivity("branches", "READ"),
  getBranchById,
);

// CREATE - catat semua field
router.post(
  "/",
  upload.single("branch_logo"),
  activityLogger.logModuleActivity("branches", "CREATE"),
  createBranch,
);

// UPDATE - catat field yang berubah
router.put(
  "/:id",
  upload.single("branch_logo"),
  activityLogger.logModuleActivity("branches", "UPDATE"),
  updateBranch,
);

// DELETE - soft delete
router.delete(
  "/:id",
  activityLogger.logModuleActivity("branches", "DELETE"),
  deleteBranch,
);

export default router;
