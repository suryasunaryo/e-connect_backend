// routes/titlesRoutes.js
import express from "express";
import {
  getAllTitles,
  createTitle,
  updateTitle,
  deleteTitle,
} from "../controllers/titlesController.js";

const router = express.Router();

router.get("/", getAllTitles);
router.post("/", createTitle);
router.put("/:id", updateTitle);
router.delete("/:id", deleteTitle);

export default router;
