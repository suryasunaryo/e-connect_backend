// routes/titlesRoutes.js
import express from "express";
import { getAllTitles } from "../controllers/titlesController.js";

const router = express.Router();

router.get("/", getAllTitles);

export default router;
