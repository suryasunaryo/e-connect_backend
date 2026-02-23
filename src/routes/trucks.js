// routes/trucks.js
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
import { getIo } from "../config/socket.js";
import { activityLogger } from "../middleware/activityLogger.js"; // ✅ IMPORT BARU
import { authenticateToken } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/* -------------------------
   Helper: base URL & map photos
------------------------- */
const getBaseUrl = (req) =>
  process.env.API_BASE_URL || `${req.protocol}://${req.get("host")}`;

const mapPhotoUrls = (photoPath, req) => {
  if (!photoPath) return null;
  try {
    const parsed =
      typeof photoPath === "string" ? JSON.parse(photoPath) : photoPath;
    if (parsed && typeof parsed === "object") {
      Object.keys(parsed).forEach((key) => {
        if (Array.isArray(parsed[key])) {
          parsed[key] = parsed[key].map((p) => `${getBaseUrl(req)}${p}`);
        } else if (typeof parsed[key] === "string") {
          parsed[key] = `${getBaseUrl(req)}${parsed[key]}`;
        }
      });
      return parsed;
    }
    // fallback single string
    return `${getBaseUrl(req)}${photoPath}`;
  } catch (err) {
    return `${getBaseUrl(req)}${photoPath}`;
  }
};

// ✅ FIXED: Helper untuk mendapatkan waktu Indonesia (UTC+7)
const getIndonesiaTime = () => {
  return DateTime.now().setZone("Asia/Jakarta").toISO();
};

const formatToMySQLDateTime = (isoString) => {
  return DateTime.fromISO(isoString)
    .setZone("Asia/Jakarta")
    .toFormat("yyyy-MM-dd HH:mm:ss");
};

/* -------------------------
   Multer storage config - FIXED: dengan async destination
------------------------- */
const createStorage = () => {
  return multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        let truck_id = "new";
        let stage = "CI"; // Default stage

        // Detect Stage based on URL
        if (req.originalUrl.includes("checkout")) {
          stage = "CO";
        } else if (req.originalUrl.includes("checkin")) {
          stage = "CI";
        } else if (req.method === "POST" && !req.params.id) {
          // Create
          stage = "CI";
        }

        // Determine ID
        if (req.params.id) {
          truck_id = req.params.id;
        } else if (req.body.license_plate) {
          // If creating new truck, use license plate as temporary ID folder or "new"
          // User requested: "jika upload di lakukan di truckform/create/update ... uploads/trucks/{truck_id}/"
          // If truck_id not yet DB generated, we must use something unique or move files later.
          // Convention: Use license plate as "ID" for folder name if ID is missing.
          truck_id = req.body.license_plate.replace(/[^a-zA-Z0-9]/g, "");
        }

        // Attach context to req for filename generation
        req.uploadContext = {
          truckId: truck_id,
          stage: stage,
        };

        console.log(`📁 Upload: ID=${truck_id}, Stage=${stage}`);

        const folderInfo = createUploadFolder(truck_id);
        // Note: createUploadFolder now simply creates/returns .../uploads/trucks/{truck_id}/

        cb(null, folderInfo.basePath);
      } catch (err) {
        console.error("❌ Multer destination error:", err);
        cb(err, null);
      }
    },
    filename: (req, file, cb) => {
      const ctx = req.uploadContext || { truckId: "unknown", stage: "CI" };
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);

      // User format: {truck_id}_{CI|CO}_{type}_{seq}_{timestamp}.{ext}
      // timestamp format implicitly: yyyyMMdd'T'HHmmss or similar from user example.
      // Example: TRUCK-000123_CI_truck_01_20260125T171722.jpg

      const type = file.fieldname.replace("_photos", "").replace("sim", "sim");
      const timestamp = DateTime.now()
        .setZone("Asia/Jakarta")
        .toFormat("yyyyMMdd'T'HHmmss");
      const seq = "01"; // Simplify sequence

      const safeId = String(ctx.truckId).replace(/[^a-zA-Z0-9-_]/g, "_");
      // Add uniqueSuffix to prevent multiple files in exact same second from overwriting each other
      const finalName = `${safeId}_${ctx.stage}_${type}_${seq}_${timestamp}_${Math.round(Math.random() * 1e6)}${ext}`;

      cb(null, finalName);
    },
  });
};

const upload = multer({
  storage: createStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("application/")
    )
      cb(null, true);
    else cb(new Error("Only images and documents are allowed"), false);
  },
});

/* ===========================
   GET all trucks - FIXED: Hanya ambil yang is_deleted = 0
=========================== */
router.get("/", async (req, res) => {
  try {
    const { status, date, include_deleted, year, month } = req.query;
    let sql = `
      SELECT *,
      CASE
        WHEN status IN ('checked_in','loading','loaded') AND check_in_time IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, check_in_time, NOW())
        WHEN status = 'checked_out' THEN duration_minutes
        WHEN status = 'cancelled' THEN NULL
        ELSE NULL
      END AS current_duration
      FROM trucks
      WHERE 1=1
    `;
    const params = [];

    // Filter deleted
    if (include_deleted !== "true") {
      sql += " AND is_deleted = 0";
    }

    if (status && status !== "all") {
      sql += " AND status = ?";
      params.push(status);
    }

    if (date) {
      sql += " AND DATE(scheduled_time) = ?";
      params.push(date);
    } else {
      if (year) {
        sql += " AND YEAR(scheduled_time) = ?";
        params.push(year);
      }
      if (month && month !== "all") {
        sql += " AND MONTH(scheduled_time) = ?";
        params.push(month);
      }
    }

    sql += " ORDER BY scheduled_time ASC, created_at DESC";

    const rows = await dbHelpers.query(sql, params);

    // Helper to map checkout photos
    const mapCheckoutPhotos = (jsonStr) => {
      if (!jsonStr) return [];
      try {
        const parsed =
          typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
        return Array.isArray(parsed)
          ? parsed.map((p) => `${getBaseUrl(req)}${p}`)
          : [];
      } catch {
        return [];
      }
    };

    const formatted = rows.map((t) => ({
      ...t,
      photo_path: mapPhotoUrls(t.photo_path, req),
      checkout_data: {
        document_number: t.document_number_out,
        truck_photos: mapCheckoutPhotos(t.truck_photos_out),
        document_photos: mapCheckoutPhotos(t.document_photos_out),
        other_photos: mapCheckoutPhotos(t.other_photos_out),
        notes: t.notes_out,
      },
    }));
    res.json(formatted);
  } catch (err) {
    console.error("❌ Error fetching trucks:", err && (err.stack || err));
    res.status(500).json({ error: "Failed to fetch trucks" });
  }
});

/* ===========================
   DEBUG: Check Database Table Structure
=========================== */
router.get("/debug-db", async (req, res) => {
  try {
    const tableCheck = await dbHelpers.query("SHOW TABLES LIKE 'trucks'");
    const columnCheck = await dbHelpers.query("DESCRIBE trucks");

    res.json({
      timestamp: new Date().toISOString(),
      table_exists: tableCheck.length > 0,
      columns: columnCheck,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

/* ===========================
   GET truck by id
=========================== */
router.get("/:id", async (req, res) => {
  try {
    const truck = await dbHelpers.queryOne(
      "SELECT * FROM trucks WHERE id = ?",
      [req.params.id],
    );
    if (!truck) return res.status(404).json({ error: "Truck not found" });

    // Helper to map checkout photos
    const mapCheckoutPhotos = (jsonStr) => {
      if (!jsonStr) return [];
      try {
        const parsed =
          typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
        return Array.isArray(parsed)
          ? parsed.map((p) => `${getBaseUrl(req)}${p}`)
          : [];
      } catch {
        return [];
      }
    };

    truck.photo_path = mapPhotoUrls(truck.photo_path, req);
    truck.checkout_data = {
      document_number: truck.document_number_out,
      truck_photos: mapCheckoutPhotos(truck.truck_photos_out),
      document_photos: mapCheckoutPhotos(truck.document_photos_out),
      other_photos: mapCheckoutPhotos(truck.other_photos_out),
      notes: truck.notes_out,
    };

    res.json(truck);
  } catch (err) {
    console.error("❌ Error fetching truck:", err && (err.stack || err));
    res.status(500).json({ error: "Failed to fetch truck" });
  }
});

/* ===========================
   CREATE new truck (multipart form)
=========================== */
router.post(
  "/",
  authenticateToken,
  upload.fields([
    { name: "truck_photos", maxCount: 5 },
    { name: "document_photos", maxCount: 5 },
    { name: "other_photos", maxCount: 5 },
    { name: "sim", maxCount: 1 },
  ]),
  activityLogger.logTruckActivity("CREATE", (req, data) => {
    return `Membuat truck baru: ${req.body.license_plate || "Unknown"} - ${req.body.driver_name || "Unknown Driver"
      }`;
  }), // ✅ TAMBAHKAN MIDDLEWARE
  async (req, res) => {
    let connection = null;
    try {
      const body = req.body || {};

      const license_plate = (body.license_plate || "").trim() || null;
      const driver_name = (body.driver_name || "").trim() || null;
      const driver_phone = body.driver_phone || null || null;
      const driver_license = body.driver_license || null || null;
      const truck_asal = (body.truck_asal || "").trim() || null;
      const destination = (body.destination || "").trim() || null;
      const document_number = body.document_number || null || null;
      const cargo_type = body.cargo_type || null || null;
      const cargo_weight = body.cargo_weight
        ? parseFloat(body.cargo_weight)
        : null;
      const priority = (body.priority || "normal").toLowerCase();

      // ✅ FIXED: Handle scheduled_time dengan timezone Indonesia
      let scheduled_time;
      if (body.scheduled_time) {
        try {
          // Terima ISO string dari frontend, konversi ke MySQL format dengan timezone Indonesia
          const dt = DateTime.fromISO(body.scheduled_time).setZone(
            "Asia/Jakarta",
          );
          if (dt.isValid) {
            scheduled_time = dt.toFormat("yyyy-MM-dd HH:mm:ss");
            console.log(
              "📅 Frontend scheduled_time (ISO):",
              body.scheduled_time,
            );
            console.log("📅 Backend scheduled_time (MySQL):", scheduled_time);
          } else {
            scheduled_time = DateTime.now()
              .setZone("Asia/Jakarta")
              .toFormat("yyyy-MM-dd HH:mm:ss");
          }
        } catch (error) {
          console.error("❌ Error parsing scheduled_time:", error);
          scheduled_time = DateTime.now()
            .setZone("Asia/Jakarta")
            .toFormat("yyyy-MM-dd HH:mm:ss");
        }
      } else {
        scheduled_time = DateTime.now()
          .setZone("Asia/Jakarta")
          .toFormat("yyyy-MM-dd HH:mm:ss");
      }

      const dock_number = body.dock_number || null || null;
      const estimated_duration = body.estimated_duration
        ? parseInt(body.estimated_duration, 10)
        : body.estimated_duration === "0"
          ? 0
          : 40; //Rubah waktu estimasi durasi di sini
      const notes = body.notes || null;
      const special_instructions = body.special_instructions || null;

      // optional created_by (if auth middleware sets req.user)
      const created_by = req.user && req.user.id ? req.user.id : null;

      if (!license_plate || !driver_name || !destination) {
        if (!destination)
          return res.status(400).json({ error: "Destination is required" });
      }

      // Build photoPaths: relative paths under /uploads
      const photoPaths = {};
      Object.keys(req.files || {}).forEach((field) => {
        const arr = req.files[field].map((file) => {
          const rel = `/uploads/trucks/${path
            .relative(
              process.env.UPLOAD_PATH ||
              path.join(__dirname, "../../uploads/trucks"),
              file.path,
            )
            .replace(/\\/g, "/")}`;
          return rel;
        });
        if (arr.length) photoPaths[field] = arr;
      });

      connection = await dbHelpers.beginTransaction();

      const insertSql = `
        INSERT INTO trucks (
          license_plate, driver_name, driver_phone, driver_license, truck_asal,
          destination, document_number, cargo_type, cargo_weight, priority,
          scheduled_time, dock_number, estimated_duration, photo_path,
          truck_photos, document_photos, other_photos, notes, special_instructions, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const truckPhotosText = photoPaths.truck_photos
        ? JSON.stringify(photoPaths.truck_photos)
        : null;
      const documentPhotosText = photoPaths.document_photos
        ? JSON.stringify(photoPaths.document_photos)
        : null;
      const otherPhotosText = photoPaths.other_photos
        ? JSON.stringify(photoPaths.other_photos)
        : null;
      const photoPathJson = Object.keys(photoPaths).length
        ? JSON.stringify(photoPaths)
        : null;

      console.log("📅 Creating truck with scheduled_time:", scheduled_time);

      const [result] = await connection.execute(insertSql, [
        license_plate,
        driver_name,
        driver_phone,
        driver_license,
        truck_asal,
        destination,
        document_number,
        cargo_type,
        cargo_weight,
        priority,
        scheduled_time,
        dock_number,
        estimated_duration,
        photoPathJson,
        truckPhotosText,
        documentPhotosText,
        otherPhotosText,
        notes,
        special_instructions,
        created_by,
      ]);

      const [rows] = await connection.execute(
        "SELECT * FROM trucks WHERE id = ?",
        [result.insertId],
      );
      const truck = rows[0];
      truck.photo_path = mapPhotoUrls(truck.photo_path, req);

      await dbHelpers.commitTransaction(connection);
      console.log("📢 Emitting truck-update: New truck created");
      getIo()?.emit("truck-update");
      res.status(201).json(truck);
    } catch (err) {
      if (connection) await dbHelpers.rollbackTransaction(connection);
      console.error("❌ Error creating truck:", err && (err.stack || err));
      res.status(500).json({ error: "Failed to create truck" });
    }
  },
);

/* ===========================
   UPDATE truck (merge photos + update fields)
=========================== */
router.put(
  "/:id",
  authenticateToken,
  upload.fields([
    { name: "truck_photos", maxCount: 5 },
    { name: "document_photos", maxCount: 5 },
    { name: "other_photos", maxCount: 5 },
    { name: "sim", maxCount: 1 },
  ]),
  activityLogger.logTruckActivity("UPDATE", (req, data) => {
    return `Memperbarui truck #${req.params.id}: ${req.body.license_plate || "Unknown"
      }`;
  }), // ✅ TAMBAHKAN MIDDLEWARE
  async (req, res) => {
    let connection = null;
    try {
      const id = req.params.id;
      const body = req.body || {};

      connection = await dbHelpers.beginTransaction();

      // fetch existing
      const existing = await connection
        .query("SELECT * FROM trucks WHERE id = ?", [id])
        .then((r) => r[0][0]);
      if (!existing) {
        await dbHelpers.rollbackTransaction(connection);
        return res.status(404).json({ error: "Truck not found" });
      }

      // Merge photo_path JSON
      let currentPhotoJson = {};
      if (existing.photo_path) {
        try {
          currentPhotoJson =
            typeof existing.photo_path === "string"
              ? JSON.parse(existing.photo_path)
              : existing.photo_path;
        } catch {
          currentPhotoJson = {};
        }
      }

      const newPhotoJson = { ...currentPhotoJson };
      const newFilesMap = {};

      Object.keys(req.files || {}).forEach((field) => {
        const arr = req.files[field].map((file) => {
          const rel = `/uploads/trucks/${path
            .relative(
              process.env.UPLOAD_PATH ||
              path.join(__dirname, "../../uploads/trucks"),
              file.path,
            )
            .replace(/\\/g, "/")}`;
          return rel;
        });
        newFilesMap[field] = arr;
        // APPEND new photos instead of overwriting existing ones
        newPhotoJson[field] = (newPhotoJson[field] || []).concat(arr);
      });

      // Also merge individual photo columns if exist
      const makeMergedCol = (colName) => {
        let baseArr = [];
        if (existing[colName]) {
          try {
            baseArr = JSON.parse(existing[colName]);
            if (!Array.isArray(baseArr)) baseArr = [];
          } catch {
            baseArr = [];
          }
        }

        if (newFilesMap[colName] && newFilesMap[colName].length > 0) {
          baseArr = baseArr.concat(newFilesMap[colName]);
        }

        return baseArr.length > 0 ? JSON.stringify(baseArr) : null;
      };

      // form fields - fallback to existing values if not provided
      const license_plate =
        body.license_plate?.trim() || existing.license_plate;
      const driver_name = body.driver_name?.trim() || existing.driver_name;
      const driver_phone = body.driver_phone || existing.driver_phone;
      const driver_license = body.driver_license || existing.driver_license;
      const truck_asal = body.truck_asal?.trim() || existing.truck_asal;
      const destination = body.destination?.trim() || existing.destination;
      const document_number = body.document_number || existing.document_number;
      const cargo_type = body.cargo_type || existing.cargo_type;
      const cargo_weight = body.cargo_weight
        ? parseFloat(body.cargo_weight)
        : existing.cargo_weight;
      const priority = (
        body.priority ||
        existing.priority ||
        "normal"
      ).toString();

      // ✅ FIXED: Handle scheduled_time dengan timezone Indonesia
      let scheduled_time;
      if (body.scheduled_time) {
        try {
          const dt = DateTime.fromISO(body.scheduled_time).setZone(
            "Asia/Jakarta",
          );
          if (dt.isValid) {
            scheduled_time = dt.toFormat("yyyy-MM-dd HH:mm:ss");
            console.log(
              "📅 Update - Frontend scheduled_time (ISO):",
              body.scheduled_time,
            );
            console.log(
              "📅 Update - Backend scheduled_time (MySQL):",
              scheduled_time,
            );
          } else {
            console.warn(
              "⚠️ Invalid scheduled_time from frontend, using existing value",
            );
            scheduled_time = existing.scheduled_time;
          }
        } catch (error) {
          console.error("❌ Error parsing scheduled_time:", error);
          scheduled_time = existing.scheduled_time;
        }
      } else {
        scheduled_time = existing.scheduled_time;
      }

      const dock_number = body.dock_number || existing.dock_number;
      const estimated_duration = body.estimated_duration
        ? parseInt(body.estimated_duration, 10)
        : existing.estimated_duration;
      const notes = body.notes || existing.notes;
      const special_instructions =
        body.special_instructions || existing.special_instructions;

      // updated_by if available
      const updated_by = req.user && req.user.id ? req.user.id : null;

      const truckPhotosText = makeMergedCol("truck_photos");
      const documentPhotosText = makeMergedCol("document_photos");
      const otherPhotosText = makeMergedCol("other_photos");

      // If those are arrays, stringify them
      const stringifyIfArr = (val) =>
        Array.isArray(val) ? JSON.stringify(val) : val;

      const updateSql = `
        UPDATE trucks SET
          license_plate = ?, driver_name = ?, driver_phone = ?, driver_license = ?,
          truck_asal = ?, destination = ?, document_number = ?, cargo_type = ?,
          cargo_weight = ?, priority = ?, scheduled_time = ?, dock_number = ?,
          estimated_duration = ?, photo_path = ?, truck_photos = ?, document_photos = ?, other_photos = ?,
          notes = ?, special_instructions = ?, updated_by = ?
        WHERE id = ?
      `;

      console.log("📅 Final scheduled_time to be saved:", scheduled_time);

      await connection.execute(updateSql, [
        license_plate,
        driver_name,
        driver_phone,
        driver_license,
        truck_asal,
        destination,
        document_number,
        cargo_type,
        cargo_weight,
        priority,
        scheduled_time,
        dock_number,
        estimated_duration,
        Object.keys(newPhotoJson).length
          ? JSON.stringify(newPhotoJson)
          : existing.photo_path,
        stringifyIfArr(truckPhotosText),
        stringifyIfArr(documentPhotosText),
        stringifyIfArr(otherPhotosText),
        notes,
        special_instructions,
        updated_by,
        id,
      ]);

      const [updatedRows] = await connection.execute(
        "SELECT * FROM trucks WHERE id = ?",
        [id],
      );
      const updated = updatedRows[0];
      updated.photo_path = mapPhotoUrls(updated.photo_path, req);

      await dbHelpers.commitTransaction(connection);
      console.log(`📢 Emitting truck-update: Truck ${id} updated`);
      getIo()?.emit("truck-update");
      res.json(updated);
    } catch (err) {
      if (connection) await dbHelpers.rollbackTransaction(connection);
      console.error("❌ Error updating truck:", err && (err.stack || err));
      res.status(500).json({ error: "Failed to update truck" });
    }
  },
);

/* ===========================
   CREATE simple calendar (JSON only)
   POST /calendar
=========================== */
router.post(
  "/calendar",
  authenticateToken,
  activityLogger.logTruckActivity("CREATE", (req, data) => {
    return `Membuat jadwal calendar: ${req.body.truck_asal || "Unknown"} -> ${req.body.destination || "Unknown"
      }`;
  }), // ✅ TAMBAHKAN MIDDLEWARE

  async (req, res) => {
    try {
      const { truck_asal, destination, scheduled_time, priority } = req.body;
      if (!truck_asal || !destination || !scheduled_time) {
        return res.status(400).json({
          error: "truck_asal, destination, and scheduled_time are required",
        });
      }

      // ✅ FIXED: Gunakan timezone Indonesia
      const formattedTime = DateTime.fromISO(scheduled_time)
        .setZone("Asia/Jakarta")
        .toFormat("yyyy-MM-dd HH:mm:ss");

      console.log(
        "📅 Calendar - Frontend scheduled_time (ISO):",
        scheduled_time,
      );
      console.log(
        "📅 Calendar - Backend scheduled_time (MySQL):",
        formattedTime,
      );

      const result = await dbHelpers.execute(
        `INSERT INTO trucks (truck_asal, destination, scheduled_time, status, priority)
       VALUES (?, ?, ?, 'scheduled', ?)`,
        [
          truck_asal,
          destination,
          formattedTime,
          (priority || "normal").toLowerCase(),
        ],
      );

      const newTruck = await dbHelpers.queryOne(
        "SELECT * FROM trucks WHERE id = ?",
        [result.insertId],
      );
      console.log("📢 Emitting truck-update: New calendar schedule created");
      getIo()?.emit("truck-update");
      res.status(201).json({ data: newTruck });
    } catch (err) {
      console.error(
        "❌ Error creating calendar schedule:",
        err && (err.stack || err),
      );
      res.status(500).json({ error: "Failed to create schedule" });
    }
  },
);

/* ===========================
   CHECK-IN with file uploads - FIXED: timezone Indonesia
=========================== */
router.post(
  "/:id/checkin",
  authenticateToken,
  upload.fields([
    { name: "truck_photos", maxCount: 5 },
    { name: "document_photos", maxCount: 5 },
    { name: "other_photos", maxCount: 5 },
    { name: "sim", maxCount: 1 },
  ]),
  activityLogger.logTruckActivity("CHECKIN", (req, data) => {
    return `Check-in truck #${req.params.id}`;
  }), // ✅ TAMBAHKAN MIDDLEWARE
  async (req, res) => {
    let connection = null;
    try {
      const { id } = req.params;
      const body = req.body || {};
      const document_number = body.document_number || null;

      // ✅ FIXED: Gunakan waktu Indonesia untuk check_in_time
      const check_in_time = formatToMySQLDateTime(getIndonesiaTime());
      console.log("🟢 CHECK-IN - Indonesia Time:", check_in_time);

      connection = await dbHelpers.beginTransaction();

      // Build photoPaths JSON
      const photoPaths = {};
      Object.keys(req.files || {}).forEach((field) => {
        const arr = req.files[field].map((file) => {
          const rel = `/uploads/trucks/${path
            .relative(
              process.env.UPLOAD_PATH ||
              path.join(__dirname, "../../uploads/trucks"),
              file.path,
            )
            .replace(/\\/g, "/")}`;
          return rel;
        });
        if (arr.length) photoPaths[field] = arr;
      });

      // Get existing photo JSON to merge
      const existing = await connection
        .query("SELECT * FROM trucks WHERE id = ?", [id])
        .then((r) => r[0][0]);
      if (!existing) {
        await dbHelpers.rollbackTransaction(connection);
        return res.status(404).json({ error: "Truck not found" });
      }

      let merged = {};
      if (existing.photo_path) {
        try {
          merged =
            typeof existing.photo_path === "string"
              ? JSON.parse(existing.photo_path)
              : existing.photo_path;
        } catch {
          merged = {};
        }
      }
      Object.keys(photoPaths).forEach((k) => {
        merged[k] = (merged[k] || []).concat(photoPaths[k]);
      });

      // also merge individual columns
      const mergeCol = (col, key) => {
        let base = [];
        if (existing[col]) {
          try {
            base = JSON.parse(existing[col]);
            if (!Array.isArray(base)) base = [];
          } catch {
            base = [];
          }
        }
        if (merged[key]) base = base.concat(merged[key]);
        return base.length ? JSON.stringify(base) : null;
      };

      const truckPhotosText = mergeCol("truck_photos", "truck_photos");
      const documentPhotosText = mergeCol("document_photos", "document_photos");
      const otherPhotosText = mergeCol("other_photos", "other_photos");

      await connection.execute(
        `UPDATE trucks SET
           status = 'checked_in',
           document_number = ?,
           check_in_time = ?,
           photo_path = ?,
           truck_photos = ?,
           document_photos = ?,
           other_photos = ?
         WHERE id = ?`,
        [
          document_number || existing.document_number,
          check_in_time,
          Object.keys(merged).length
            ? JSON.stringify(merged)
            : existing.photo_path,
          truckPhotosText,
          documentPhotosText,
          otherPhotosText,
          id,
        ],
      );

      const [rows] = await connection.execute(
        "SELECT * FROM trucks WHERE id = ?",
        [id],
      );
      const truck = rows[0];
      truck.photo_path = mapPhotoUrls(truck.photo_path, req);

      await dbHelpers.commitTransaction(connection);
      console.log(`📢 Emitting truck-update: Truck ${id} checked in`);
      getIo()?.emit("truck-update");
      res.json(truck);
    } catch (err) {
      if (connection) await dbHelpers.rollbackTransaction(connection);
      console.error("❌ Error checkin:", err && (err.stack || err));
      res.status(500).json({ error: "Failed to checkin truck" });
    }
  },
);

/* ===========================
   START LOADING - FIXED: timezone Indonesia
=========================== */
router.post(
  "/:id/start-loading",
  authenticateToken,
  activityLogger.logTruckActivity("START_LOADING", (req, data) => {
    return `Memulai loading truck #${req.params.id}`;
  }), // ✅ TAMBAHKAN MIDDLEWARE

  async (req, res) => {
    try {
      const { id } = req.params;
      // ✅ FIXED: Gunakan waktu Indonesia
      const startTime = formatToMySQLDateTime(getIndonesiaTime());
      console.log("🟡 START LOADING - Indonesia Time:", startTime);

      await dbHelpers.execute(
        `UPDATE trucks SET status = 'loading', loading_start_time = ? WHERE id = ?`,
        [startTime, id],
      );
      const updated = await dbHelpers.queryOne(
        "SELECT * FROM trucks WHERE id = ?",
        [id],
      );
      console.log(`📢 Emitting truck-update: Truck ${id} started loading`);
      getIo()?.emit("truck-update");
      res.json(updated);
    } catch (err) {
      console.error("❌ Error starting loading:", err && (err.stack || err));
      res.status(500).json({ error: "Failed to start loading" });
    }
  },
);

/* ===========================
   END LOADING - FIXED: timezone Indonesia
=========================== */
router.post(
  "/:id/end-loading",
  authenticateToken,
  activityLogger.logTruckActivity("END_LOADING", (req, data) => {
    return `Mengakhiri loading truck #${req.params.id}`;
  }), // ✅ TAMBAHKAN MIDDLEWARE

  async (req, res) => {
    try {
      const { id } = req.params;
      // ✅ FIXED: Gunakan waktu Indonesia
      const endTime = formatToMySQLDateTime(getIndonesiaTime());
      console.log("🟣 END LOADING - Indonesia Time:", endTime);

      const truck = await dbHelpers.queryOne(
        "SELECT * FROM trucks WHERE id = ?",
        [id],
      );
      if (!truck || !truck.loading_start_time)
        return res
          .status(400)
          .json({ error: "Truck not in loading or missing start time" });

      const duration_minutes = Math.round(
        (new Date(endTime) - new Date(truck.loading_start_time)) / 60000,
      );

      await dbHelpers.execute(
        `UPDATE trucks SET status = 'loaded', loading_end_time = ?, duration_minutes = ? WHERE id = ?`,
        [endTime, duration_minutes, id],
      );
      const updated = await dbHelpers.queryOne(
        "SELECT * FROM trucks WHERE id = ?",
        [id],
      );
      console.log(`📢 Emitting truck-update: Truck ${id} ended loading`);
      getIo()?.emit("truck-update");
      res.json(updated);
    } catch (err) {
      console.error("❌ Error ending loading:", err && (err.stack || err));
      res.status(500).json({ error: "Failed to end loading" });
    }
  },
);

/* ===========================
   DELETE - FIXED: Soft delete dengan update flag is_deleted
=========================== */
router.delete(
  "/:id",
  authenticateToken,
  activityLogger.logTruckActivity("DELETE", (req, data) => {
    return `Soft delete truck #${req.params.id}`;
  }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { cancellation_reason } = req.body; // ✅ Ambil alasan dari body

      // ✅ FIXED: Soft delete dengan update flag is_deleted DAN cancellation_reason
      await dbHelpers.execute(
        "UPDATE trucks SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, cancellation_reason = ? WHERE id = ?",
        [cancellation_reason || null, id],
      );

      console.log(`📢 Emitting truck-update: Truck ${id} deleted (soft)`);
      getIo()?.emit("truck-update");

      res.json({
        success: true,
        message: "Truck berhasil dihapus (soft delete)",
        truck_id: id,
      });
    } catch (err) {
      console.error("❌ Error soft deleting truck:", err && (err.stack || err));
      res.status(500).json({ error: "Failed to delete truck" });
    }
  },
);

/* ===========================
   CANCEL truck - update status to cancelled
=========================== */
router.post(
  "/:id/cancel",
  authenticateToken,
  activityLogger.logTruckActivity("CANCEL", (req, data) => {
    return `Membatalkan truck #${req.params.id}: ${req.body.cancellation_reason || "Tanpa alasan"
      }`;
  }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { cancellation_reason } = req.body;

      // ✅ FIXED: Gunakan waktu Indonesia
      const cancelled_time = formatToMySQLDateTime(getIndonesiaTime());
      console.log("🔴 CANCEL - Indonesia Time:", cancelled_time);
      console.log("🔴 CANCEL - Reason:", cancellation_reason);

      // Cek apakah truck exists dan belum di-delete
      const existingTruck = await dbHelpers.queryOne(
        "SELECT * FROM trucks WHERE id = ? AND is_deleted = 0",
        [id],
      );

      if (!existingTruck) {
        return res
          .status(404)
          .json({ error: "Truck not found or already deleted" });
      }

      // Update status menjadi cancelled
      await dbHelpers.execute(
        `UPDATE trucks SET 
         status = 'cancelled', 
         cancelled_time = ?,
         cancellation_reason = ?,
         updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? AND is_deleted = 0`,
        [cancelled_time, cancellation_reason || null, id],
      );

      // Ambil data truck yang sudah di-update
      const updated = await dbHelpers.queryOne(
        "SELECT * FROM trucks WHERE id = ?",
        [id],
      );

      if (!updated) {
        return res.status(404).json({ error: "Truck not found after update" });
      }

      // Map photo URLs untuk response
      updated.photo_path = mapPhotoUrls(updated.photo_path, req);

      console.log(`📢 Emitting truck-update: Truck ${id} cancelled`);
      getIo()?.emit("truck-update");

      res.json({
        success: true,
        message: "Truck berhasil dibatalkan",
        data: updated,
      });
    } catch (err) {
      console.error("❌ Error cancelling truck:", err && (err.stack || err));
      res.status(500).json({ error: "Failed to cancel truck" });
    }
  },
);

/* ===========================
   CHECK-OUT with file uploads
=========================== */
router.post(
  "/:id/checkout",
  authenticateToken,
  upload.fields([
    { name: "truck_photos", maxCount: 5 },
    { name: "document_photos", maxCount: 5 },
    { name: "other_photos", maxCount: 5 },
  ]),
  activityLogger.logTruckActivity("CHECKOUT", (req, data) => {
    return `Check-out truck #${req.params.id}`;
  }),
  async (req, res) => {
    let connection = null;
    try {
      const { id } = req.params;
      const { check_out_time_iso, document_number, notes } = req.body || {};
      const check_out_time = check_out_time_iso
        ? formatToMySQLDateTime(check_out_time_iso)
        : formatToMySQLDateTime(getIndonesiaTime());

      console.log("🔵 CHECK-OUT - Indonesia Time:", check_out_time);

      connection = await dbHelpers.beginTransaction();

      const truck = await connection
        .query(
          "SELECT * FROM trucks WHERE id = ? AND status IN ('checked_in', 'loading', 'loaded')",
          [id],
        )
        .then((r) => r[0][0]);

      if (!truck) {
        console.warn(
          `⚠️ Checkout rejected: Truck ${id} not found or status not checked_in`,
        );
        await dbHelpers.rollbackTransaction(connection);
        return res.status(400).json({
          error: "Truck not found or not checked in",
        });
      }

      const checkInTime = new Date(truck.check_in_time);
      const checkOutTimeDate = new Date(check_out_time);
      const duration_minutes = Math.round(
        (checkOutTimeDate.getTime() - checkInTime.getTime()) / (1000 * 60),
      );

      console.log("🔵 CHECKOUT BODY:", req.body);
      console.log(
        "🔵 CHECKOUT FILES:",
        req.files ? Object.keys(req.files) : "None",
      );

      const buildPhotoJson = (fieldName) => {
        if (
          !req.files ||
          !req.files[fieldName] ||
          req.files[fieldName].length === 0
        )
          return null;
        const paths = req.files[fieldName].map((file) => {
          const normalizedPath = file.path.split(path.sep).join("/");
          const uploadIndex = normalizedPath.indexOf("/uploads/");
          if (uploadIndex !== -1) {
            return normalizedPath.substring(uploadIndex);
          }
          return `/uploads/trucks/${id}/${path.basename(file.path)}`;
        });
        return JSON.stringify(paths);
      };

      console.log("▶️ START CHECKOUT TRANSACTION");

      const truck_photos = buildPhotoJson("truck_photos");
      const document_photos = buildPhotoJson("document_photos");
      const other_photos = buildPhotoJson("other_photos");
      const created_by = req.user?.id || null;

      console.log("📝 Data preparing for trucks UPDATE (checkout):", {
        truck_id: id,
        document_number: document_number || "NULL",
        has_truck_photos: !!truck_photos,
        has_doc_photos: !!document_photos,
        notes: notes || "NULL",
        created_by,
      });

      try {
        await connection.execute(
          `UPDATE trucks SET 
          status = "checked_out", 
          check_out_time = ?, 
          duration_minutes = ?,
          document_number_out = ?,
          truck_photos_out = ?,
          document_photos_out = ?,
          other_photos_out = ?,
          notes_out = ?
          WHERE id = ?`,
          [
            check_out_time,
            duration_minutes,
            document_number || null,
            truck_photos,
            document_photos,
            other_photos,
            notes || null,
            id,
          ],
        );
        console.log(`✅ UPDATE trucks checkout SUCCESS for ID: ${id}`);
      } catch (err) {
        console.error("❌ UPDATE trucks checkout FAILED:", err);
        throw err;
      }

      const updated = await connection
        .query("SELECT * FROM trucks WHERE id = ?", [id])
        .then((r) => r[0][0]);
      updated.photo_path = mapPhotoUrls(updated.photo_path, req);

      await dbHelpers.commitTransaction(connection);

      console.log(`📢 Emitting truck-update: Truck ${id} checked out`);
      getIo()?.emit("truck-update");

      res.json(updated);
    } catch (err) {
      if (connection) await dbHelpers.rollbackTransaction(connection);
      console.error("❌ Error checking out truck:", err && (err.stack || err));
      res.status(500).json({ error: "Failed to check out truck" });
    }
  },
);

export default router;
