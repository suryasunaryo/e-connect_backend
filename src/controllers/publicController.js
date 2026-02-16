import { dbHelpers } from "../config/database.js";
import { emitDataChange } from "../utils/socketHelpers.js";

export const getPublicNews = async (req, res) => {
  try {
    // Fetch news that are targeted to 'all', published, and within valid dates
    const sql = `
      SELECT n.*, IFNULL(u.full_name, u.username) as creator_name
      FROM news n
      LEFT JOIN users u ON n.created_by = u.id
      WHERE n.deleted_at IS NULL 
      AND n.status = 'published'
      AND (n.close_date IS NULL OR n.close_date > CURRENT_TIMESTAMP)
      AND (n.publish_at IS NULL OR n.publish_at <= CURRENT_TIMESTAMP)
      AND EXISTS (
        SELECT 1 FROM news_targets nt 
        WHERE nt.news_id = n.id 
        AND nt.target_type = 'all'
      )
      ORDER BY n.pin_top DESC, n.priority DESC, n.created_at DESC
      LIMIT 10
    `;

    const news = await dbHelpers.query(sql);

    // Fetch targets for each news (mostly to confirm it's 'all')
    if (news.length > 0) {
      const newsIds = news.map((r) => r.id);
      const targets = await dbHelpers.query(
        `SELECT id, news_id, target_type, target_value FROM news_targets WHERE news_id IN (${newsIds.map(() => "?").join(",")})`,
        newsIds,
      );

      news.forEach((row) => {
        row.targets = targets.filter((t) => t.news_id === row.id);
      });
    }

    res.json({ success: true, data: news });
  } catch (error) {
    console.error("❌ Get public news error:", error);
    res.status(500).json({ error: "Failed to fetch public news" });
  }
};

export const getPublicBanners = async (req, res) => {
  try {
    // Fetch active and not deleted banners from the new banners table
    const sql = `
      SELECT * FROM banners 
      WHERE is_deleted = 0 
      AND is_active = 1
      ORDER BY priority DESC, created_at DESC
    `;

    const banners = await dbHelpers.query(sql);
    res.json({ success: true, data: banners });
  } catch (error) {
    console.error("❌ Get public banners error:", error);
    res.status(500).json({ error: "Failed to fetch public banners" });
  }
};

export const getPublicNewsById = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch news details ensuring it's public (targeted at 'all') and published
    const sql = `
      SELECT n.*, IFNULL(u.full_name, u.username) as creator_name
      FROM news n
      LEFT JOIN users u ON n.created_by = u.id
      WHERE n.id = ?
      AND n.deleted_at IS NULL 
      AND n.status = 'published'
      AND (n.close_date IS NULL OR n.close_date > CURRENT_TIMESTAMP)
      AND (n.publish_at IS NULL OR n.publish_at <= CURRENT_TIMESTAMP)
      AND EXISTS (
        SELECT 1 FROM news_targets nt 
        WHERE nt.news_id = n.id 
        AND nt.target_type = 'all'
      )
    `;

    const news = await dbHelpers.query(sql, [id]);

    if (news.length === 0) {
      return res
        .status(404)
        .json({ error: "Public news not found or access restricted" });
    }

    // Fetch public files (only files associated with this news)
    const files = await dbHelpers.query(
      "SELECT * FROM news_files WHERE news_id = ?",
      [id],
    );

    res.json({
      success: true,
      data: {
        news: news[0],
        files: files,
        targets: [{ target_type: "all" }], // Mocking target since we verified it's 'all'
      },
    });
  } catch (error) {
    console.error("❌ Get public news detail error:", error);
    res.status(500).json({ error: "Failed to fetch news detail" });
  }
};

export const getPublicEmployeeByRfid = async (req, res) => {
  try {
    const { rfid_number } = req.body;

    if (!rfid_number) {
      return res.status(400).json({ error: "RFID number is required" });
    }

    const employee = await dbHelpers.queryOne(
      `
      SELECT 
        e.full_name, 
        e.nik, 
        e.picture, 
        e.employee_status,
        d.dept_name as department_name,
        p.position_name,
        t.title_name,
        b.branch_name
      FROM employees e 
      LEFT JOIN departments d ON e.department_id = d.id 
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN titles t ON e.title_id = t.id
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE e.rfid_number = ? AND e.deleted_at IS NULL
    `,
      [rfid_number],
    );

    if (!employee) {
      return res.status(404).json({ error: "Card not recognized" });
    }

    res.json(employee);
  } catch (error) {
    console.error("❌ Error scanning RFID (public):", error);
    res.status(500).json({ error: "Failed to scan RFID" });
  }
};

// Save RFID log immediately after scan (without photo)
export const savePublicRfidLog = async (req, res) => {
  try {
    const { nik, rfid_number, full_name } = req.body;

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    const result = await dbHelpers.execute(
      "INSERT INTO attendance_log (nik, full_name, rfid_number, picture, attendance_date, attendance_time) VALUES (?, ?, ?, ?, ?, ?)",
      [nik, full_name, rfid_number, null, dateStr, timeStr],
    );

    const newLog = {
      id: result.insertId,
      nik,
      full_name,
      rfid_number,
      picture: null,
      attendance_date: dateStr,
      attendance_time: timeStr,
      created_at: now.toISOString(),
    };

    emitDataChange("attendance_logs", "create", newLog);

    console.log(`✅ RFID log saved immediately for NIK: ${nik}`);

    res.json({
      success: true,
      message: "Attendance log saved successfully",
      log_id: result.insertId,
    });
  } catch (error) {
    console.error("❌ Error saving RFID log (public):", error);
    res.status(500).json({ error: error.message });
  }
};

export const uploadPublicAttendanceCapture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { nik, is_matched } = req.body;
    console.log("📥 Public upload capture request body:", req.body);
    const matchedValue = is_matched || null;
    const relativePath = req.file.path.split("uploads")[1];
    const filePath = `/uploads${relativePath.replace(/\\/g, "/")}`;

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    // Try to find existing log from today for this NIK
    const [existingLogs] = await dbHelpers.query(
      "SELECT id FROM attendance_log WHERE nik = ? AND attendance_date = ? ORDER BY id DESC LIMIT 1",
      [nik, dateStr],
    );

    let logId;
    if (existingLogs.length > 0) {
      // Update existing log with photo and match status
      logId = existingLogs[0].id;
      await dbHelpers.execute(
        "UPDATE attendance_log SET picture = ?, is_matched = ? WHERE id = ?",
        [filePath, matchedValue, logId],
      );
      console.log(
        `📸 Updated existing log ${logId} with photo and match=${matchedValue} for NIK: ${nik}`,
      );
    } else {
      // Fallback: create new log if not found (backward compatibility)
      const [empRows] = await dbHelpers.query(
        "SELECT full_name, rfid_number FROM employees WHERE nik = ?",
        [nik],
      );
      const emp = empRows[0] || {};

      const result = await dbHelpers.execute(
        "INSERT INTO attendance_log (nik, full_name, rfid_number, picture, is_matched, attendance_date, attendance_time) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          nik,
          emp.full_name || "Unknown",
          emp.rfid_number || "Unknown",
          filePath,
          matchedValue,
          dateStr,
          timeStr,
        ],
      );
      logId = result.insertId;
      console.log(
        `📸 Created new log ${logId} with photo and match=${matchedValue} for NIK: ${nik} (fallback)`,
      );
    }

    // Emit update event
    emitDataChange("attendance_logs", "update", {
      id: logId,
      picture: filePath,
      is_matched: matchedValue,
    });

    res.json({
      success: true,
      message: "Attendance photo uploaded successfully",
      file_path: filePath,
      log_id: logId,
      is_matched: matchedValue,
    });
  } catch (error) {
    console.error("❌ Error uploading attendance capture (public):", error);
    res.status(500).json({ error: error.message });
  }
};
