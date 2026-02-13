import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  getAttendanceCodes,
  createAttendanceCode,
  updateAttendanceCode,
  deleteAttendanceCode,
  getEmployeeShifts,
  createEmployeeShift,
  updateEmployeeShift,
  deleteEmployeeShift,
  getAttendanceSettings,
  createAttendanceSetting,
  updateAttendanceSetting,
  deleteAttendanceSetting,
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  getShiftRules,
  createShiftRule,
  updateShiftRule,
  deleteShiftRule,
  saveRfidLog,
  uploadAttendanceCapture,
  getAttendanceLogs,
  deleteAttendanceLog,
} from "../controllers/attendanceController.js";

import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Configure Multer for Attendance Captures
// Configure Multer for Attendance Captures
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Format Date ddMMyyyy
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const dateStr = `${day}${month}${year}`;

    // Get NIK from body (ensure NIK is sent BEFORE file in FormData)
    const nik = req.body.nik || "unknown";

    // Path: uploads/absensi/{tglblnthn}/{NIK}/
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
    // Format Date ddMMyyyy
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const dateStr = `${day}${month}${year}`;

    // Add Time HHmmss to allow multiple captures
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const timeStr = `${hours}${minutes}${seconds}`;

    const nik = req.body.nik || "unknown";
    const ext = path.extname(file.originalname);

    // Filename: absensi-{NIK}-{tglblnthn}-{HHmmss}
    cb(null, `absensi-${nik}-${dateStr}-${timeStr}${ext}`);
  },
});

const upload = multer({ storage: storage });

// Attendance Codes
router.get("/codes", getAttendanceCodes);
router.post("/codes", createAttendanceCode);
router.put("/codes/:id", updateAttendanceCode);
router.delete("/codes/:id", deleteAttendanceCode);

// Attendance Capture
// Attendance Capture (RFID)
router.post("/rfid-log", saveRfidLog);
router.post("/capture", upload.single("file"), uploadAttendanceCapture);

// Attendance Logs
router.get("/logs", getAttendanceLogs);
router.delete("/logs/:id", deleteAttendanceLog);

// Employee Shifts
router.get("/employee-shifts", getEmployeeShifts);
router.post("/employee-shifts", createEmployeeShift);
router.put("/employee-shifts/:id", updateEmployeeShift);
router.delete("/employee-shifts/:id", deleteEmployeeShift);

// Attendance Settings
router.get("/settings", getAttendanceSettings);
router.post("/settings", createAttendanceSetting);
router.put("/settings/:id", updateAttendanceSetting);
router.delete("/settings/:id", deleteAttendanceSetting);

// Shifts
router.get("/shifts", getShifts);
router.post("/shifts", createShift);
router.put("/shifts/:id", updateShift);
router.delete("/shifts/:id", deleteShift);

// Shift Rules
router.get("/shift-rules", getShiftRules);
router.post("/shift-rules", createShiftRule);
router.put("/shift-rules/:id", updateShiftRule);
router.delete("/shift-rules/:id", deleteShiftRule);

export default router;
