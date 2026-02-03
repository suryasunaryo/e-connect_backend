import { getDB } from "../config/database.js";
import { DateTime } from "luxon";
import { emitDataChange } from "../utils/socketHelpers.js";

// ✅ FIXED: Helper untuk mendapatkan waktu Indonesia
const getIndonesiaTime = () => {
  return DateTime.now().setZone("Asia/Jakarta").toFormat("yyyy-MM-dd HH:mm:ss");
};

export const truckController = {
  // Get all trucks with filtering
  getAllTrucks: (req, res) => {
    const db = getDB();
    const { status, date } = req.query;

    let query = `
      SELECT *, 
      CASE 
        WHEN status = 'checked_in' THEN 
          CAST((julianday('now') - julianday(check_in_time)) * 24 * 60 AS INTEGER)
        WHEN status = 'checked_out' THEN 
          duration_minutes
        ELSE NULL 
      END as current_duration
      FROM trucks 
    `;
    let params = [];

    if (status && status !== "all") {
      query += " WHERE status = ?";
      params.push(status);
    } else if (date) {
      query += " WHERE DATE(scheduled_time) = ?";
      params.push(date);
    }

    query += " ORDER BY scheduled_time ASC, created_at DESC";

    db.all(query, params, (err, rows) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Failed to fetch trucks" });
      }

      // Convert photo paths to full URLs
      const trucksWithPhotoUrls = rows.map((truck) => ({
        ...truck,
        photo_path: truck.photo_path ? `${API_BASE}${truck.photo_path}` : null,
      }));

      res.json({ data: trucksWithPhotoUrls });
    });
  },

  // Get truck by ID
  getTruckById: (req, res) => {
    const db = getDB();
    const { id } = req.params;

    db.get("SELECT * FROM trucks WHERE id = ?", [id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }
      if (!row) {
        return res.status(404).json({ error: "Truck not found" });
      }

      // Convert photo path to full URL
      if (row.photo_path) {
        row.photo_path = `${API_BASE}${row.photo_path}`;
      }

      res.json(row);
    });
  },

  // Create new truck
  createTruck: (req, res) => {
    const db = getDB();
    const {
      license_plate,
      driver_name,
      destination,
      document_number,
      scheduled_time,
    } = req.body;

    if (!license_plate || !driver_name || !destination) {
      return res.status(400).json({
        error: "License plate, driver name, and destination are required",
      });
    }

    const photo_path = req.file ? `/uploads/trucks/${req.file.filename}` : null;

    // ✅ FIXED: Handle scheduled_time dengan timezone Indonesia
    let formattedScheduledTime;
    if (scheduled_time) {
      try {
        const dt = DateTime.fromISO(scheduled_time).setZone("Asia/Jakarta");
        if (dt.isValid) {
          formattedScheduledTime = dt.toFormat("yyyy-MM-dd HH:mm:ss");
        } else {
          formattedScheduledTime = getIndonesiaTime();
        }
      } catch (error) {
        formattedScheduledTime = getIndonesiaTime();
      }
    } else {
      formattedScheduledTime = getIndonesiaTime();
    }

    console.log("📅 Create Truck - Scheduled Time:", formattedScheduledTime);

    db.run(
      `INSERT INTO trucks (
        license_plate, driver_name, destination, document_number, 
        scheduled_time, photo_path, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
      [
        license_plate,
        driver_name,
        destination,
        document_number,
        formattedScheduledTime,
        photo_path,
      ],
      function (err) {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ error: "Failed to create truck schedule" });
        }

        db.get(
          "SELECT * FROM trucks WHERE id = ?",
          [this.lastID],
          (err, row) => {
            if (err) {
              return res
                .status(500)
                .json({ error: "Failed to fetch created truck" });
            }

            if (row.photo_path) {
              row.photo_path = `${API_BASE}${row.photo_path}`;
            }

            emitDataChange("trucks", "create", row);

            res.status(201).json(row);
          },
        );
      },
    );
  },

  // Update truck
  updateTruck: (req, res) => {
    const db = getDB();
    const { id } = req.params;
    const {
      license_plate,
      driver_name,
      destination,
      document_number,
      scheduled_time,
    } = req.body;

    // ✅ FIXED: Handle scheduled_time dengan timezone Indonesia
    let formattedScheduledTime;
    if (scheduled_time) {
      try {
        const dt = DateTime.fromISO(scheduled_time).setZone("Asia/Jakarta");
        if (dt.isValid) {
          formattedScheduledTime = dt.toFormat("yyyy-MM-dd HH:mm:ss");
        } else {
          // Jika invalid, ambil existing value dari database
          db.get(
            "SELECT scheduled_time FROM trucks WHERE id = ?",
            [id],
            (err, row) => {
              if (row) {
                formattedScheduledTime = row.scheduled_time;
              } else {
                formattedScheduledTime = getIndonesiaTime();
              }
            },
          );
        }
      } catch (error) {
        formattedScheduledTime = getIndonesiaTime();
      }
    } else {
      formattedScheduledTime = getIndonesiaTime();
    }

    console.log("📅 Update Truck - Scheduled Time:", formattedScheduledTime);

    let query = `
      UPDATE trucks SET 
      license_plate = ?, driver_name = ?, destination = ?, 
      document_number = ?, scheduled_time = ?, updated_at = CURRENT_TIMESTAMP
    `;
    let params = [
      license_plate,
      driver_name,
      destination,
      document_number,
      formattedScheduledTime,
    ];

    if (req.file) {
      query += ", photo_path = ?";
      params.push(`/uploads/trucks/${req.file.filename}`);
    }

    query += " WHERE id = ?";
    params.push(id);

    db.run(query, params, function (err) {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Failed to update truck" });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "Truck not found" });
      }

      db.get("SELECT * FROM trucks WHERE id = ?", [id], (err, row) => {
        if (err) {
          return res
            .status(500)
            .json({ error: "Failed to fetch updated truck" });
        }

        if (row.photo_path) {
          row.photo_path = `${API_BASE}${row.photo_path}`;
        }

        emitDataChange("trucks", "update", row);

        res.json(row);
      });
    });
  },

  // Delete truck
  deleteTruck: (req, res) => {
    const db = getDB();
    const { id } = req.params;

    db.run("DELETE FROM trucks WHERE id = ?", [id], function (err) {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "Truck not found" });
      }
      emitDataChange("trucks", "delete", { id });
      res.json({ message: "Truck deleted successfully" });
    });
  },

  // Check in truck - FIXED: timezone Indonesia
  checkInTruck: (req, res) => {
    const db = getDB();
    const { id } = req.params;
    const check_in_time = getIndonesiaTime(); // ✅ FIXED: Gunakan waktu Indonesia

    console.log("🟢 CHECK-IN - Indonesia Time:", check_in_time);

    db.run(
      'UPDATE trucks SET status = "checked_in", check_in_time = ? WHERE id = ? AND status = "scheduled"',
      [check_in_time, id],
      function (err) {
        if (err) {
          return res.status(500).json({ error: "Database error" });
        }
        if (this.changes === 0) {
          return res
            .status(400)
            .json({ error: "Truck not found or already checked in" });
        }

        db.get("SELECT * FROM trucks WHERE id = ?", [id], (err, row) => {
          if (err) {
            return res.status(500).json({ error: "Failed to fetch truck" });
          }
          emitDataChange("trucks", "update", row);
          res.json(row);
        });
      },
    );
  },

  // Check out truck - FIXED: timezone Indonesia
  checkOutTruck: (req, res) => {
    const db = getDB();
    const { id } = req.params;
    const check_out_time = getIndonesiaTime(); // ✅ FIXED: Gunakan waktu Indonesia

    console.log("🔵 CHECK-OUT - Indonesia Time:", check_out_time);

    db.get(
      'SELECT * FROM trucks WHERE id = ? AND status = "checked_in"',
      [id],
      (err, truck) => {
        if (err) {
          return res.status(500).json({ error: "Database error" });
        }
        if (!truck) {
          return res
            .status(400)
            .json({ error: "Truck not found or not checked in" });
        }

        const check_in_time = new Date(truck.check_in_time);
        const duration_minutes = Math.round(
          (new Date(check_out_time) - check_in_time) / (1000 * 60),
        );

        // Files from form-data
        const document_number = req.body.document_number;
        const notes = req.body.notes;
        const created_by = req.user?.id || null;

        const files = req.files || {};
        const truck_photos = files.truck_photos
          ? JSON.stringify(
              files.truck_photos.map((f) => `/uploads/trucks/${f.filename}`),
            )
          : null;
        const document_photos = files.document_photos
          ? JSON.stringify(
              files.document_photos.map((f) => `/uploads/trucks/${f.filename}`),
            )
          : null;
        const other_photos = files.other_photos
          ? JSON.stringify(
              files.other_photos.map((f) => `/uploads/trucks/${f.filename}`),
            )
          : null;

        db.run("BEGIN TRANSACTION", function (err) {
          if (err) return res.status(500).json({ error: "Transaction error" });

          // 1. Insert into trucks_out
          db.run(
            `INSERT INTO trucks_out 
              (truck_id, document_number, truck_photos, document_photos, other_photos, notes, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              document_number,
              truck_photos,
              document_photos,
              other_photos,
              notes,
              created_by,
            ],
            function (err) {
              if (err) {
                console.error("Error inserting trucks_out:", err);
                db.run("ROLLBACK");
                return res
                  .status(500)
                  .json({ error: "Failed to record checkout details" });
              }

              // 2. Update trucks status
              db.run(
                'UPDATE trucks SET status = "checked_out", check_out_time = ?, duration_minutes = ? WHERE id = ?',
                [check_out_time, duration_minutes, id],
                function (err) {
                  if (err) {
                    console.error("Error updating trucks:", err);
                    db.run("ROLLBACK");
                    return res
                      .status(500)
                      .json({ error: "Failed to update truck status" });
                  }

                  db.run("COMMIT", function (err) {
                    if (err) {
                      db.run("ROLLBACK");
                      return res.status(500).json({ error: "Commit error" });
                    }

                    db.get(
                      "SELECT * FROM trucks WHERE id = ?",
                      [id],
                      (err, row) => {
                        if (row) {
                          emitDataChange("trucks", "update", row);
                          res.json(row);
                        } else {
                          res.json({ success: true });
                        }
                      },
                    );
                  });
                },
              );
            },
          );
        });
      },
    );
  },
};
