import express from "express";
import {
  markAsViewed,
  getViewedItems,
} from "../controllers/itemViewController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/view", markAsViewed);
router.get("/viewed", getViewedItems);

export default router;
