import express from "express";
import {
  getAllPortalSettings,
  createPortalSetting,
  updatePortalSetting,
  deletePortalSetting,
  getUploadFiles,
  uploadPortalFile,
  deletePortalFile,
} from "../controllers/portalSettingsController.js";
import { activityLogger } from "../middleware/activityLogger.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/portal/";
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});
const portalUpload = upload.single("portal_image");

const fileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/portal_files/";
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

const uploadFile = multer({
  storage: fileStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

const router = express.Router();

router.get("/", getAllPortalSettings);
router.get("/files", getUploadFiles);
router.post("/upload-file", uploadFile.single("file"), uploadPortalFile);
router.post("/delete-file", deletePortalFile);

router.post(
  "/",
  portalUpload,
  activityLogger.logModuleActivity("portal_settings", "CREATE"),
  createPortalSetting,
);

router.put(
  "/:id",
  portalUpload,
  activityLogger.logModuleActivity("portal_settings", "UPDATE"),
  updatePortalSetting,
);

router.delete(
  "/:id",
  activityLogger.logModuleActivity("portal_settings", "DELETE"),
  deletePortalSetting,
);

export default router;
