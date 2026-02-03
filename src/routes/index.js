// routes/index.js
import express from "express";
import truckRoutes from "./trucks.js";
import authRoutes from "./auth.js";
import activityLogRoutes from "./activityLogs.js"; // ✅ IMPORT BARU
import attendanceRoutes from "./attendanceRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import itemViewRoutes from "./itemViewRoutes.js";

const router = express.Router();

console.log("🔄 Loading routes...");

// =======================================================
// 🧩 REGISTER API ROUTES
// =======================================================
router.use("/trucks", truckRoutes); // ✅ sudah termasuk /calendar di dalamnya
console.log("✅ Trucks routes loaded: /api/trucks");

router.use("/auth", authRoutes);
console.log("✅ Auth routes loaded: /api/auth");
router.use("/activity-logs", activityLogRoutes); // ✅ TAMBAHKAN ROUTE BARU
router.use("/attendance", attendanceRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/notifications", notificationRoutes);
router.use("/items", itemViewRoutes);
console.log("✅ Dashboard routes loaded: /api/dashboard");

// =======================================================
// 🩺 HEALTH CHECK & DEBUG ROUTES
// =======================================================
router.get("/health", (req, res) => {
  console.log("❤️ Health check called");
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "Truck Queue System API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

router.get("/api", (req, res) => {
  console.log("🏠 API dashboard called");
  res.json({
    message: "Truck Queue Management System API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      trucks: "/api/trucks",
      health: "/api/health",
    },
  });
});

router.get("/test", (req, res) => {
  console.log("🧪 Test route called");
  res.json({ message: "Test route working!" });
});

// =======================================================
// 🚨 FALLBACK UNTUK ROUTE TAK DIKENAL
// =======================================================
router.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

console.log("✅ All routes loaded successfully");

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "API is working!" });
});

export default router;
