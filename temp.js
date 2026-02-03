import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { DateTime } from "luxon";
import fs from "fs";
import {
  dbHelpers,
  createUploadFolder,
  getPhotoTypeFolder,
} from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

/* ===========================================================
   🧩 Utility functions
=========================================================== */
const getBaseUrl = (req) =>
  process.env.API_BASE_URL || `${req.protocol}://${req.get("host")}`;

const mapPhotoUrls = (photoPath, req) => {
  if (!photoPath) return null;
  try {
    const parsed = JSON.parse(photoPath);
    Object.keys(parsed).forEach((key) => {
      parsed[key] = parsed[key].map((p) => `${getBaseUrl(req)}${p}`);
    });
    return parsed;
  } catch {
    return `${getBaseUrl(req)}${photoPath}`;
  }
};

/* ===========================================================
   🖼️ Multer Setup — dynamic folder per truk & tanggal checkin
=========================================================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const { truck_asal, license_plate, checkin_date } = req.body;

      if (!truck_asal || !license_plate || !checkin_date) {
        return cb(
          new Error("truck_asal, license_plate, and checkin_date are required"),
          null
        );
      }

      // Buat folder /uploads/{tanggal}/{asal}/{nopol}/{kategori}
      const folderInfo = createUploadFolder(
        license_plate,
        checkin_date,
        truck_asal
      );
      const folderPath = getPhotoTypeFolder(file.fieldname, folderInfo);

      fs.mkdirSync(folderPath, { recursive: true });
      cb(null, folderPath);
    } catch (err) {
      console.error("❌ Multer destination error:", err);
      cb(err, null);
    }
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${path.basename(file.originalname, ext)}-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("application/")
    )
      cb(null, true);
    else cb(new Error("Only images and documents allowed"), false);
  },
});

/* ===========================================================
   📦 API ROUTES
=========================================================== */

/* ========== GET ALL ========== */
router.get("/", async (req, res) => {
  try {
    const { status, date } = req.query;
    let sql = `
      SELECT *,
      CASE 
        WHEN status = 'loading' THEN TIMESTAMPDIFF(MINUTE, loading_start_time, NOW())
        WHEN status = 'checked_out' THEN duration_minutes
        ELSE NULL
      END AS current_duration
      FROM trucks
    `;
    const params = [];

    if (status && status !== "all") {
      sql += " WHERE status = ?";
      params.push(status);
    } else if (date) {
      sql += " WHERE DATE(scheduled_time) = ?";
      params.push(date);
    }

    sql += " ORDER BY scheduled_time ASC, created_at DESC";
    const trucks = await dbHelpers.query(sql, params);

    const formatted = trucks.map((t) => ({
      ...t,
      photo_path: mapPhotoUrls(t.photo_path, req),
    }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ Error fetching trucks:", err);
    res.status(500).json({ error: "Failed to fetch trucks" });
  }
});

/* ========== CREATE TRUCK SCHEDULE (JSON ONLY) ========== */
router.post("/calendar", async (req, res) => {
  try {
    const { truck_asal, destination, scheduled_time } = req.body;
    if (!truck_asal || !destination || !scheduled_time) {
      return res.status(400).json({
        error: "truck_asal, destination, and scheduled_time are required",
      });
    }

    const formattedTime = DateTime.fromISO(scheduled_time).toFormat(
      "yyyy-MM-dd HH:mm:ss"
    );

    const result = await dbHelpers.execute(
      `INSERT INTO trucks (truck_asal, destination, scheduled_time, status)
       VALUES (?, ?, ?, 'scheduled')`,
      [truck_asal, destination, formattedTime]
    );

    const newTruck = await dbHelpers.queryOne(
      "SELECT * FROM trucks WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({ data: newTruck });
  } catch (err) {
    console.error("❌ Error creating truck:", err);
    res.status(500).json({ error: "Failed to create schedule" });
  }
});

/* ========== CHECK-IN WITH FILE UPLOADS ========== */
router.post(
  "/:id/checkin",
  upload.fields([
    { name: "truck_photos", maxCount: 5 },
    { name: "document_photos", maxCount: 5 },
    { name: "other_photos", maxCount: 5 },
    { name: "sim", maxCount: 1 },
  ]),
  async (req, res) => {
    let connection = null;
    try {
      const { id } = req.params;
      const { document_number } = req.body;
      const check_in_time = new Date();

      connection = await dbHelpers.beginTransaction();

      // Build photo JSON paths
      const photoPaths = {};
      Object.keys(req.files || {}).forEach((field) => {
        photoPaths[field] = req.files[field].map((file) => {
          const rel = `/uploads/${path
            .relative(
              process.env.UPLOAD_PATH || path.join(__dirname, "../../uploads"),
              file.path
            )
            .replace(/\\/g, "/")}`;
          return rel;
        });
      });

      await connection.execute(
        `UPDATE trucks SET 
          status = 'checked_in',
          document_number = ?,
          check_in_time = ?,
          photo_path = ? 
        WHERE id = ?`,
        [
          document_number || "N/A",
          check_in_time,
          Object.keys(photoPaths).length ? JSON.stringify(photoPaths) : null,
          id,
        ]
      );

      const [rows] = await connection.execute(
        "SELECT * FROM trucks WHERE id = ?",
        [id]
      );

      const truck = rows[0];
      truck.photo_path = mapPhotoUrls(truck.photo_path, req);

      await dbHelpers.commitTransaction(connection);
      res.json(truck);
    } catch (err) {
      if (connection) await dbHelpers.rollbackTransaction(connection);
      console.error("❌ Error checkin:", err);
      res.status(500).json({ error: "Failed to check-in truck" });
    }
  }
);

/* ========== START LOADING ========== */
router.post("/:id/start-loading", async (req, res) => {
  try {
    const { id } = req.params;
    const startTime = new Date();

    await dbHelpers.execute(
      `UPDATE trucks 
       SET status = 'loading', loading_start_time = ? 
       WHERE id = ?`,
      [startTime, id]
    );

    const updated = await dbHelpers.queryOne(
      "SELECT * FROM trucks WHERE id = ?",
      [id]
    );

    res.json(updated);
  } catch (err) {
    console.error("❌ Error starting loading:", err);
    res.status(500).json({ error: "Failed to start loading" });
  }
});

/* ========== END LOADING ========== */
router.post("/:id/end-loading", async (req, res) => {
  try {
    const { id } = req.params;
    const endTime = new Date();

    const truck = await dbHelpers.queryOne(
      "SELECT * FROM trucks WHERE id = ?",
      [id]
    );
    if (!truck || !truck.loading_start_time) {
      return res
        .status(400)
        .json({ error: "Truck not in loading or missing start time" });
    }

    const duration_minutes = Math.round(
      (endTime - new Date(truck.loading_start_time)) / 60000
    );

    await dbHelpers.execute(
      `UPDATE trucks 
       SET status = 'loaded', loading_end_time = ?, duration_minutes = ?
       WHERE id = ?`,
      [endTime, duration_minutes, id]
    );

    const updated = await dbHelpers.queryOne(
      "SELECT * FROM trucks WHERE id = ?",
      [id]
    );

    res.json(updated);
  } catch (err) {
    console.error("❌ Error ending loading:", err);
    res.status(500).json({ error: "Failed to end loading" });
  }
});

/* ========== CHECK-OUT ========== */
router.post("/:id/checkout", async (req, res) => {
  try {
    const { id } = req.params;
    const check_out_time = new Date();

    await dbHelpers.execute(
      `UPDATE trucks 
       SET status = 'checked_out', check_out_time = ? 
       WHERE id = ?`,
      [check_out_time, id]
    );

    const updated = await dbHelpers.queryOne(
      "SELECT * FROM trucks WHERE id = ?",
      [id]
    );

    res.json(updated);
  } catch (err) {
    console.error("❌ Error checking out:", err);
    res.status(500).json({ error: "Failed to check out truck" });
  }
});

/* ========== DELETE TRUCK ========== */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await dbHelpers.execute("DELETE FROM trucks WHERE id = ?", [id]);
    res.json({ message: "Truck deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting truck:", err);
    res.status(500).json({ error: "Failed to delete truck" });
  }
});

export default router;
