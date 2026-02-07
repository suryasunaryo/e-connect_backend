import express from "express";
import * as employeeSetupController from "../controllers/employeeSetupController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// All routes are protected
router.use(authenticateToken);

router.get("/options", employeeSetupController.getBatchSetupOptions);
router.post("/update", employeeSetupController.batchUpdateEmployees);

export default router;
