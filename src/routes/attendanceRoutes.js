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
} from "../controllers/attendanceController.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Attendance Codes
router.get("/codes", getAttendanceCodes);
router.post("/codes", createAttendanceCode);
router.put("/codes/:id", updateAttendanceCode);
router.delete("/codes/:id", deleteAttendanceCode);

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
