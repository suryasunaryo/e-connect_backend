import express from "express";
import {
  getAllCalendarEvents,
  getCompanyEvents,
  getNationalHolidays,
  createCompanyEvent,
  updateCompanyEvent,
  deleteCompanyEvent,
  refreshNationalHolidays,
  getEventColors,
  updateEventColor,
} from "../controllers/workCalendarController.js";
import { activityLogger } from "../middleware/activityLogger.js";

const router = express.Router();

// GET all calendar events (merged: company + national holidays)
router.get("/", getAllCalendarEvents);

// GET company events only
router.get("/company", getCompanyEvents);

// GET national holidays for specific year
router.get("/national/:year", getNationalHolidays);

// GET event colors
router.get("/colors", getEventColors);

// UPDATE event color
router.put(
  "/colors/:eventType",
  activityLogger.logModuleActivity("work_calendar", "UPDATE_COLOR"),
  updateEventColor
);

// CREATE company event
router.post(
  "/",
  activityLogger.logModuleActivity("work_calendar", "CREATE"),
  createCompanyEvent
);

// UPDATE company event
router.put(
  "/:id",
  activityLogger.logModuleActivity("work_calendar", "UPDATE"),
  updateCompanyEvent
);

// DELETE company event
router.delete(
  "/:id",
  activityLogger.logModuleActivity("work_calendar", "DELETE"),
  deleteCompanyEvent
);

// REFRESH national holidays cache
router.post("/refresh-holidays/:year", refreshNationalHolidays);

export default router;
