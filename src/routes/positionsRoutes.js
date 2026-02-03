// routes/positionsRoutes.js
import express from "express";
import {
  getAllPositions,
  getPositionsByBranch,
} from "../controllers/positionsController.js";

const router = express.Router();

router.get("/", getAllPositions);
router.get("/branch/:branchId", getPositionsByBranch);

export default router;
