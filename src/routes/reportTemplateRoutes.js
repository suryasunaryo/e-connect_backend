import express from "express";
import reportTemplateController from "../controllers/reportTemplateController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication to all designer routes
router.use(authenticateToken);

router.get("/", reportTemplateController.getAllTemplates);
router.get("/:id", reportTemplateController.getTemplateById);
router.post("/", reportTemplateController.createTemplate);
router.put("/:id", reportTemplateController.updateTemplate);
router.delete("/:id", reportTemplateController.deleteTemplate);

export default router;
