import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  getAvailableCards,
  getUserCardPreferences,
  updateCardPreference,
  bulkUpdateCardPreferences,
  resetToDefaults,
} from "../controllers/dashboardController.js";

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

export default router;
