import { createServer } from "http";
import express from "express";
import cors from "cors";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { initSocket, getIo } from "./config/socket.js";
import apiRoutes from "./routes/index.js";
import { initDatabase, getPool } from "./config/database.js";
import userRoutes from "./routes/users.js";
import departementRoutes from "./routes/departementRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import branchesRoutes from "./routes/branchesRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import TitlesRoutes from "./routes/titlesRoutes.js";
import PositionsRoutes from "./routes/positionsRoutes.js";
import workCalendarRoutes from "./routes/workCalendarRoutes.js";
import calendarEventTypeRoutes from "./routes/calendarEventTypeRoutes.js";
import userRoleRoutes from "./routes/userRoleRoutes.js";
import { authenticateToken } from "./middleware/auth.js";
import newsRoutes from "./routes/newsRoutes.js";
import portalSettingsRoutes from "./routes/portalSettingsRoutes.js";
import employeeSetupRoutes from "./routes/employeeSetupRoutes.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Initialize Socket.io
initSocket(server);

const PORT = process.env.PORT || 4000;

// =======================================================
// 🧩 MIDDLEWARES
// =======================================================
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static folder for uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// =======================================================
// 🩺 HEALTH CHECK
// =======================================================
app.get("/api/health", async (req, res) => {
  try {
    const pool = getPool();
    const conn = await pool.getConnection();
    await conn.query("SELECT 1");
    conn.release();
    res.json({
      status: "OK",
      message: "Database connected successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Database not reachable",
      error: error.message,
    });
  }
});

// =======================================================
// 🚀 REGISTER API ROUTES
// =======================================================
app.use("/api/news", newsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/user-roles", authenticateToken, userRoleRoutes);
app.use("/api/departments", authenticateToken, departementRoutes);
app.use("/api/employees", authenticateToken, employeeRoutes);
app.use("/api/branches", authenticateToken, branchesRoutes);
app.use("/api/location", authenticateToken, locationRoutes);
app.use("/api/titles", authenticateToken, TitlesRoutes);
app.use("/api/positions", authenticateToken, PositionsRoutes);
app.use("/api/work-calendar", authenticateToken, workCalendarRoutes);
app.use(
  "/api/calendar-event-types",
  authenticateToken,
  calendarEventTypeRoutes,
);
app.use("/api/portal-settings", authenticateToken, portalSettingsRoutes);
app.use("/api/employee-batch-setup", authenticateToken, employeeSetupRoutes);
app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.send("🚛 Truck Queue API is running fine!");
});

// Fallback 404 for /api
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// NETWORK INFO helper
const getLocalIp = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (
        iface.family === "IPv4" &&
        !iface.internal &&
        !iface.address.startsWith("169.")
      ) {
        return iface.address;
      }
    }
  }
  return "localhost";
};

const localIp = getLocalIp();

// =======================================================
// 🧹 INACTIVITY CLEANUP JOB
// Sets is_online = 0 for users inactive for > 10 minutes
// =======================================================
const initInactivityCleanup = () => {
  const CLEANUP_INTERVAL = 60 * 1000; // 1 menit
  const INACTIVITY_LIMIT_MINUTES = 10;

  setInterval(async () => {
    try {
      const pool = getPool();
      const [result] = await pool.query(
        `UPDATE users 
         SET is_online = 0 
         WHERE is_online = 1 
         AND last_activity < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
        [INACTIVITY_LIMIT_MINUTES],
      );

      if (result.affectedRows > 0) {
        console.log(
          `🧹 Inactivity Cleanup: Set ${result.affectedRows} users to offline`,
        );
        // Emitting socket event for real-time dashboard updates
        const io = getIo();
        if (io) {
          io.emit("user:status_changed", {
            type: "cleanup",
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      console.error("❌ Inactivity Cleanup Error:", error);
    }
  }, CLEANUP_INTERVAL);
};

// =======================================================
// 🧠 START SERVER
// =======================================================
const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }
    await initDatabase();
    initInactivityCleanup(); // Start cleanup job
    server.listen(PORT, () => {
      console.log("🚀 Server started successfully!");
      console.log(`📍 Local:   http://localhost:${PORT}`);
      console.log(`📡 Network: http://${localIp}:${PORT}`);
      console.log(`📊 API:     http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();
