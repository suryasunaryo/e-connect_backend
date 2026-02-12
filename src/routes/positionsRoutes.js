// routes/positionsRoutes.js
import express from "express";
import {
  getAllPositions,
  getPositionsByBranch,
  createPosition,
  updatePosition,
  deletePosition,
  getPositionTree,
  movePosition,
} from "../controllers/positionsController.js";

const router = express.Router();

router.get("/", getAllPositions);
router.get("/tree", getPositionTree);
router.get("/branch/:branchId", getPositionsByBranch);
router.post("/", createPosition);
router.post("/move", movePosition);
router.put("/:id", updatePosition);
router.delete("/:id", deletePosition);

export default router;
