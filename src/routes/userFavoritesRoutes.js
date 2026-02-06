import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  getUserFavorites,
  addFavorite,
  removeFavorite,
} from "../controllers/userFavoritesController.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// All routes require authentication (handled by middleware above)
router.get("/", getUserFavorites);
router.post("/", addFavorite);
router.delete("/:portal_app_id", removeFavorite);

export default router;
