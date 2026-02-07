// backend/src/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { dbHelpers } from "../config/database.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { activityLogger } from "../middleware/activityLogger.js";
import { getIo } from "../config/socket.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Multer for Profile Pictures (using same path as employees)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../../uploads/employees");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file gambar yang diperbolehkan"), false);
    }
  },
});

const router = express.Router();

/**
 * 🧠 Helper untuk membuat JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "24h" },
  );
};

/**
 * 🔐 LOGIN ENDPOINT dengan logging
 */
router.post(
  "/login",
  activityLogger.logAuthActivity("LOGIN"),
  async (req, res) => {
    try {
      const { username, password } = req.body;

      // Validasi input
      if (!username || !password) {
        return res
          .status(400)
          .json({ error: "Username dan password harus diisi" });
      }

      // Cari user aktif + data karyawan (departemen/cabang/posisi)
      const user = await dbHelpers.queryOne(
        `SELECT u.*, e.department_id, e.branch_id, e.position_id, COALESCE(u.profile_picture, e.picture) as profile_picture 
         FROM users u
         LEFT JOIN employees e ON (e.user_id = u.id OR e.nik = u.username) AND e.deleted_at IS NULL
         WHERE u.username = ? AND u.is_active = TRUE`,
        [username],
      );

      // Check if user is locked
      if (user) {
        console.log("🔍 Login check for:", user.username);
        console.log("🔒 Locked Until (DB):", user.locked_until);
        console.log("🕒 Current Time:", new Date());

        if (user.locked_until && new Date(user.locked_until) > new Date()) {
          console.log("⛔ Account is locked!");
          return res.status(403).json({
            error: "Akun terkunci",
            lockedUntil: user.locked_until,
          });
        }
      }

      // Validasi user dan password
      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: "Username atau password salah" });
      }

      // Update last login and online status
      await dbHelpers.execute(
        "UPDATE users SET last_login = NOW(), is_online = 1, last_activity = NOW() WHERE id = ?",
        [user.id],
      );

      // Emit Socket.IO event for user login
      const io = getIo();
      if (io) {
        io.emit("user:status_changed", {
          userId: user.id,
          username: user.username,
          isOnline: true,
          timestamp: new Date(),
        });
      }

      // Generate token
      const token = generateToken(user);

      res.json({
        success: true,
        message: "Login berhasil",
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          menu_groups: user.menu_groups,
          menu_access: user.menu_access,
          menu_permissions: user.menu_permissions,
          department_id: user.department_id,
          branch_id: user.branch_id,
          position_id: user.position_id,
          profile_picture: user.profile_picture,
          last_login: user.last_login,
        },
      });
    } catch (error) {
      console.error("❌ Login error:", error);
      res.status(500).json({ error: "Terjadi kesalahan saat login" });
    }
  },
);

/**
 * LOGOUT ENDPOINT dengan logging
 */
router.post(
  "/logout",
  verifyToken,
  activityLogger.logAuthActivity("LOGOUT"),
  async (req, res) => {
    try {
      console.log(
        "🚪 Logout request received for user:",
        req.user?.id,
        req.user?.username,
      );

      if (req.user && req.user.id) {
        const result = await dbHelpers.execute(
          "UPDATE users SET is_online = 0 WHERE id = ?",
          [req.user.id],
        );

        console.log(
          "✅ Database updated, is_online set to 0 for user:",
          req.user.id,
        );
        console.log("📊 Rows affected:", result.affectedRows);

        // Emit Socket.IO event for user logout
        const io = getIo();
        if (io) {
          console.log("📡 Emitting Socket.IO event: user:status_changed");
          io.emit("user:status_changed", {
            userId: req.user.id,
            username: req.user.username,
            isOnline: false,
            timestamp: new Date(),
          });
        } else {
          console.warn("⚠️ Socket.IO not initialized, event not emitted");
        }
      }
      res.json({
        success: true,
        message: "Logout berhasil",
      });
    } catch (error) {
      console.error("❌ Logout error:", error);
      res.status(500).json({ error: "Terjadi kesalahan saat logout" });
    }
  },
);

/**
 * 🔎 VERIFY TOKEN
 */
router.post("/verify", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ valid: false, error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Pastikan user masih aktif + ambil data karyawan
    const user = await dbHelpers.queryOne(
      `SELECT u.*, e.department_id, e.branch_id, e.position_id, COALESCE(u.profile_picture, e.picture) as profile_picture 
       FROM users u 
       LEFT JOIN employees e ON (e.user_id = u.id OR e.nik = u.username) AND e.deleted_at IS NULL
       WHERE u.id = ? AND u.is_active = TRUE`,
      [decoded.id],
    );

    if (!user) {
      return res
        .status(401)
        .json({ valid: false, error: "User no longer exists" });
    }

    res.json({ valid: true, user });
  } catch (error) {
    console.error("❌ Verify token error:", error);
    res.status(401).json({ valid: false, error: "Invalid or expired token" });
  }
});

/**
 * 👤 GET PROFILE
 */
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await dbHelpers.queryOne(
      "SELECT id, username, role, full_name, email, last_login, created_at FROM users WHERE id = ?",
      [req.user.id],
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("❌ Profile fetch error:", error);
    res.status(500).json({ error: "Failed to retrieve profile" });
  }
});

/**
 * 👤 GET PROFILE DETAILS (Employees + Users join)
 */
router.get("/profile-details", verifyToken, async (req, res) => {
  try {
    const details = await dbHelpers.queryOne(
      `SELECT 
        u.id as user_id,
        u.username,
        u.full_name as user_full_name,
        u.email as user_email,
        u.phone as user_phone,
        e.id as employee_id,
        e.full_name as employee_full_name,
        e.nik,
        e.barcode,
        e.picture,
        e.employee_status,
        e.join_date,
        e.office_email,
        e.personal_email,
        e.phone as employee_phone,
        d.dept_name as department_name,
        p.position_name,
        t.title_name,
        r.role_name
      FROM users u
      LEFT JOIN employees e ON (e.user_id = u.id OR e.nik = u.username) AND e.deleted_at IS NULL
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN titles t ON e.title_id = t.id
      LEFT JOIN users_role r ON u.role = r.role_id
      WHERE u.id = ?`,
      [req.user.id],
    );

    if (!details) {
      return res.status(404).json({ error: "User detail tidak ditemukan" });
    }

    res.json(details);
  } catch (error) {
    console.error("❌ Profile details fetch error:", error);
    res.status(500).json({ error: "Gagal memuat detail profil" });
  }
});

/**
 * ✏️ UPDATE PROFILE (Self)
 */
router.put(
  "/profile-update",
  verifyToken,
  upload.single("picture"),
  activityLogger.logUserActivity("UPDATE"),
  async (req, res) => {
    try {
      const { office_email, personal_email, phone, password } = req.body;
      const userId = req.user.id;

      // 1. Get current data to know employee_id
      const current = await dbHelpers.queryOne(
        "SELECT id, user_id FROM employees WHERE user_id = ?",
        [userId],
      );

      // Handle picture path if uploaded
      let picturePath = null;
      if (req.file) {
        picturePath = `/uploads/employees/${req.file.filename}`;
        console.log("📸 New profile picture uploaded:", picturePath);
      } else {
        console.log("ℹ️ No new picture uploaded");
      }

      const pool = await dbHelpers.getPool();
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        // Update Employees table if exists
        if (current) {
          const empUpdates = [];
          const empValues = [];

          if (office_email !== undefined) {
            empUpdates.push("office_email = ?");
            empValues.push(office_email);
          }
          if (personal_email !== undefined) {
            empUpdates.push("personal_email = ?");
            empValues.push(personal_email);
          }
          if (phone !== undefined) {
            empUpdates.push("phone = ?");
            empValues.push(phone);
          }
          if (picturePath) {
            empUpdates.push("picture = ?");
            empValues.push(picturePath);
          }

          if (empUpdates.length > 0) {
            empValues.push(current.id);
            await connection.query(
              `UPDATE employees SET ${empUpdates.join(", ")} WHERE id = ?`,
              empValues,
            );
          }
        }

        // Update Users table
        const userUpdates = [];
        const userValues = [];

        // Sync email/phone if they were updated and provided
        // Priority for office_email as primary email
        if (office_email) {
          userUpdates.push("email = ?");
          userValues.push(office_email);
        } else if (personal_email) {
          userUpdates.push("email = ?");
          userValues.push(personal_email);
        }

        if (phone) {
          userUpdates.push("phone = ?");
          userValues.push(phone);
        }

        if (picturePath) {
          userUpdates.push("profile_picture = ?");
          userValues.push(picturePath);
        }

        if (password && password.trim() !== "") {
          const hashed = bcrypt.hashSync(password, 10);
          userUpdates.push("password = ?");
          userValues.push(hashed);
        }

        if (userUpdates.length > 0) {
          userValues.push(userId);
          const [userResult] = await connection.query(
            `UPDATE users SET ${userUpdates.join(", ")} WHERE id = ?`,
            userValues,
          );
          console.log(
            "✅ User table updated, affectedRows:",
            userResult.affectedRows,
          );
        } else {
          console.log("ℹ️ No user fields to update");
        }

        await connection.commit();
        res.json({
          success: true,
          message: "Profil berhasil diperbarui",
          picture: picturePath,
        });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("❌ Profile update error:", error);
      res.status(500).json({ error: "Gagal memperbarui profil" });
    }
  },
);

/**
 * 🧪 HEALTH ENDPOINT
 */
router.get("/health", async (req, res) => {
  try {
    const result = await dbHelpers.queryOne("SELECT 1 AS db_check");
    if (result) {
      res.json({ status: "OK", database: "connected", timestamp: new Date() });
    } else {
      res.status(500).json({ status: "ERROR", message: "DB check failed" });
    }
  } catch (error) {
    console.error("❌ Auth health check error:", error);
    res
      .status(500)
      .json({ status: "ERROR", message: "Database not reachable" });
  }
});

export default router;
