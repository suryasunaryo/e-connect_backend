import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  getAvailableCards,
  getUserCardPreferences,
  updateCardPreference,
  bulkUpdateCardPreferences,
  resetToDefaults,
  getWhosOnline,
  getCalendarEvents,
  updateGlobalCardDefaults,
  getPersonalStats,
} from "../controllers/dashboardController.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// GET - Get all available dashboard cards
router.get("/cards", authenticateToken, getAvailableCards);

// GET - Get current user's card preferences
router.get("/preferences", authenticateToken, getUserCardPreferences);

// PUT - Update single card preference
router.put("/preferences/:cardId", authenticateToken, updateCardPreference);

// PUT - Bulk update card preferences
router.put("/preferences", authenticateToken, bulkUpdateCardPreferences);

// POST - Reset to default preferences
router.post("/preferences/reset", authenticateToken, resetToDefaults);

// POST - Update global default dashboard layout (Admin only)
router.post(
  "/cards/defaults",
  authenticateToken,
  requireAdmin,
  updateGlobalCardDefaults,
);

// GET - Get who's online (currently active users)
router.get("/whos-online", authenticateToken, getWhosOnline);

// GET - Get calendar events for widget
router.get("/calendar-events", authenticateToken, getCalendarEvents);

// GET - Get personal stats for quick stats widget
router.get("/person-stats", authenticateToken, getPersonalStats);

export default router;
