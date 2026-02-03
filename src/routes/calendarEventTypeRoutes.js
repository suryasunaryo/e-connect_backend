import express from "express";
import {
  getAllEventTypes,
  createEventType,
  updateEventType,
  deleteEventType,
} from "../controllers/calendarEventTypeController.js";
import { activityLogger } from "../middleware/activityLogger.js";

const router = express.Router();

router.get("/", getAllEventTypes);

router.post(
  "/",
  activityLogger.logModuleActivity("calendar_event_types", "CREATE"),
  createEventType,
);

router.put(
  "/:id",
  activityLogger.logModuleActivity("calendar_event_types", "UPDATE"),
  updateEventType,
);

router.delete(
  "/:id",
  activityLogger.logModuleActivity("calendar_event_types", "DELETE"),
  deleteEventType,
);

export default router;
