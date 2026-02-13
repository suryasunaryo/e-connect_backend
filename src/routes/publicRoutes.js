import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  getPublicNews,
  getPublicBanners,
  getPublicNewsById,
  getPublicEmployeeByRfid,
  savePublicRfidLog,
  uploadPublicAttendanceCapture,
} from "../controllers/publicController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure Multer for Public Attendance Captures (same as attendanceRoutes.js)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const dateStr = `${day}${month}${year}`;
    const nik = req.body.nik || "unknown";

    const uploadPath = path.join(
      __dirname,
      `../../uploads/absensi/${dateStr}/${nik}`,
    );

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const dateStr = `${day}${month}${year}`;

    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const timeStr = `${hours}${minutes}${seconds}`;

    const nik = req.body.nik || "unknown";
    const ext = path.extname(file.originalname);

    cb(null, `absensi-${nik}-${dateStr}-${timeStr}${ext}`);
  },
});

const upload = multer({ storage: storage });

router.get("/news", getPublicNews);
router.get("/news/:id", getPublicNewsById);
router.get("/banners", getPublicBanners);

// New Public Display Routes
router.post("/employees/scan-rfid", getPublicEmployeeByRfid);
router.post("/attendance/rfid-log", savePublicRfidLog);
router.post(
  "/attendance/capture",
  upload.single("file"),
  uploadPublicAttendanceCapture,
);

export default router;
