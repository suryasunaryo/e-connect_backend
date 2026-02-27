import { getPool } from "../config/database.js";

/**
 * 📊 Get RFID Report Data
 */
export const getDailyReport = async (req, res) => {
  try {
    const { startDate, endDate, search } = req.query;
    const pool = getPool();

    let query = `
      SELECT 
        e.picture as photo,
        e.full_name as name,
        e.nik,
        s.attendance_date as date,
        s.clock_in,
        s.clock_out,
        s.status,
        s.status_off,
        s.face_log_count,
        s.shift_name as shift,
        s.shift_code,
        s.shift_start_time as schedule_on_time,
        s.shift_end_time as schedule_off_time,
        b.branch_name,
        (SELECT GROUP_CONCAT(dept_name SEPARATOR ', ') FROM departments WHERE FIND_IN_SET(id, e.department_id)) as department_name,
        l.office_name as location_name
      FROM attendance_summary s
      JOIN employees e ON s.nik = e.nik
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN location l ON e.location_id = l.id
      WHERE 1=1
    `;
    const params = [];

    if (startDate && endDate) {
      query += " AND s.attendance_date BETWEEN ? AND ?";
      params.push(startDate, endDate);
    } else {
      query += " AND s.attendance_date = CURDATE()";
    }

    if (search) {
      query += " AND (e.full_name LIKE ? OR e.nik LIKE ?)";
      const searchVal = `%${search}%`;
      params.push(searchVal, searchVal);
    }

    query += " ORDER BY s.attendance_date DESC, e.full_name ASC";

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Get daily report error:", error);
    res.status(500).json({ error: "Gagal mengambil data report RFID" });
  }
};

/**
 * 🔄 Sync Attendance Logs to Summary table
 */
export const syncAttendanceSummary = async (req, res) => {
  try {
    const { date, startDate, endDate } = req.body;
    const pool = getPool();

    // Support single date or range
    let targetDates = [];
    if (startDate && endDate) {
      let start = new Date(startDate);
      let end = new Date(endDate);
      while (start <= end) {
        targetDates.push(start.toISOString().split("T")[0]);
        start.setDate(start.getDate() + 1);
      }
    } else {
      targetDates = [date || new Date().toISOString().split("T")[0]];
    }

    let totalSynced = 0;

    for (const targetDate of targetDates) {
      // 1. Get all RFID logs for the target date
      const [allLogs] = await pool.query(
        `SELECT nik, attendance_time, is_matched 
         FROM attendance_log 
         WHERE attendance_date = ?`,
        [targetDate],
      );

      if (allLogs.length === 0) continue;

      const logsByNik = allLogs.reduce((acc, log) => {
        if (!acc[log.nik]) acc[log.nik] = [];
        acc[log.nik].push(log);
        return acc;
      }, {});

      const niks = Object.keys(logsByNik);

      // 2. Fetch employee info
      const [employees] = await pool.query(
        `SELECT id, nik, employee_shift_id FROM employees WHERE nik IN (?)`,
        [niks],
      );

      // Fetch global settings once per date loop if needed
      const [settingsRows] = await pool.query(
        "SELECT setting_key, setting_value FROM attendance_settings WHERE is_deleted = 0 OR is_deleted IS NULL",
      );
      const settings = settingsRows.reduce((acc, s) => {
        acc[s.setting_key] = s.setting_value;
        return acc;
      }, {});

      console.log(
        `👥 Syncing ${employees.length} employees for date ${targetDate}`,
      );

      // 3. Process each employee
      for (const emp of employees) {
        const empLogs = logsByNik[emp.nik];
        if (!empLogs) continue;

        const clockIn = empLogs.reduce(
          (min, log) => (log.attendance_time < min ? log.attendance_time : min),
          empLogs[0].attendance_time,
        );
        const clockOut = empLogs.reduce(
          (max, log) => (log.attendance_time > max ? log.attendance_time : max),
          empLogs[0].attendance_time,
        );
        const faceLogCount = empLogs.length;

        let status = "ON TIME";
        let statusOff = "ON TIME";
        let usedShiftName = "-";
        let usedShiftCode = "-";
        let usedShiftStart = null;
        let usedShiftEnd = null;

        // Day of week from YYYY-MM-DD string consistently
        const d = new Date(targetDate);
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        const dayOfWeek = dayNames[d.getUTCDay()]; // "Monday", etc.

        // STATUS CALCULATION LOGIC
        if (emp.employee_shift_id) {
          const shiftValue = String(emp.employee_shift_id);

          if (shiftValue.includes("setting")) {
            // MODE 2: SETTING RULES
            usedShiftName = "GLOBAL SETTING";
            usedShiftCode = "GS";
            const globalStartTime = settings["work_start_time"] || "08:00:00";
            const globalEndTime = settings["work_end_time"] || "17:00:00";
            usedShiftStart = globalStartTime;
            usedShiftEnd = globalEndTime;

            const globalLateTolerance = parseInt(
              settings["late_tolerance_minutes"] || "0",
            );

            // Duty On Status
            if (clockIn > globalStartTime) {
              const diffMs =
                new Date(`1970-01-01T${clockIn}`) -
                new Date(`1970-01-01T${globalStartTime}`);
              const diffMins = Math.floor(diffMs / 60000);

              if (diffMins > globalLateTolerance) {
                status = `Late ${diffMins} mins`;
              } else {
                status = "ON TIME";
              }
            } else if (clockIn < globalStartTime) {
              const diffMs =
                new Date(`1970-01-01T${globalStartTime}`) -
                new Date(`1970-01-01T${clockIn}`);
              const diffMins = Math.floor(diffMs / 60000);
              status = `Early Check In ${diffMins} mins`;
            }

            // Duty Off Status
            if (clockOut && globalEndTime) {
              const diffMs =
                new Date(`1970-01-01T${clockOut}`) -
                new Date(`1970-01-01T${globalEndTime}`);
              const diffMins = Math.abs(Math.floor(diffMs / 60000));

              if (clockOut < globalEndTime) {
                statusOff = `Early Check Out ${diffMins} mins`;
              } else if (clockOut > globalEndTime) {
                statusOff = `Late Check Out ${diffMins} mins`;
              } else {
                statusOff = "ON TIME";
              }
            }
          } else {
            // MODE 1: SHIFT RULES
            try {
              const shiftIds = shiftValue
                .split(",")
                .filter((id) => id && id !== "setting");
              if (shiftIds.length > 0) {
                const [shifts] = await pool.query(
                  "SELECT * FROM attendance_shifts WHERE shift_id IN (?)",
                  [shiftIds],
                );

                const activeShift = shifts.find((s) => {
                  try {
                    const workDays =
                      typeof s.work_days === "string"
                        ? JSON.parse(s.work_days)
                        : s.work_days;
                    return (
                      Array.isArray(workDays) && workDays.includes(dayOfWeek)
                    );
                  } catch (e) {
                    return false;
                  }
                });

                if (activeShift) {
                  usedShiftName = activeShift.shift_name;
                  usedShiftCode = activeShift.shift_code;
                  usedShiftStart = activeShift.start_time;
                  usedShiftEnd = activeShift.end_time;

                  const startTime = activeShift.start_time;
                  const endTime = activeShift.end_time;

                  // Fetch shift rules
                  const [rulesRows] = await pool.query(
                    "SELECT * FROM attendance_shift_rules WHERE shift_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)",
                    [activeShift.shift_id],
                  );
                  const rule = rulesRows[0] || {};
                  const lateTolerance = parseInt(
                    rule.late_tolerance_minutes || 0,
                  );

                  // Duty On Status
                  if (clockIn > startTime) {
                    const diffMs =
                      new Date(`1970-01-01T${clockIn}`) -
                      new Date(`1970-01-01T${startTime}`);
                    const diffMins = Math.floor(diffMs / 60000);

                    if (diffMins > lateTolerance) {
                      status = `Late ${diffMins} mins`;
                    } else {
                      status = "ON TIME";
                    }
                  } else if (clockIn < startTime) {
                    const diffMs =
                      new Date(`1970-01-01T${startTime}`) -
                      new Date(`1970-01-01T${clockIn}`);
                    const diffMins = Math.floor(diffMs / 60000);
                    status = `Early Check In ${diffMins} mins`;
                  }

                  // Duty Off Status
                  if (clockOut && endTime) {
                    const diffMs =
                      new Date(`1970-01-01T${clockOut}`) -
                      new Date(`1970-01-01T${endTime}`);
                    const diffMins = Math.abs(Math.floor(diffMs / 60000));

                    if (clockOut < endTime) {
                      statusOff = `Early Check Out ${diffMins} mins`;
                    } else if (clockOut > endTime) {
                      statusOff = `Late Check Out ${diffMins} mins`;
                    } else {
                      statusOff = "ON TIME";
                    }
                  }
                } else {
                  status = "NO SHIFT ATTACHED";
                  statusOff = "-";
                }
              } else {
                status = "NO SHIFT ATTACHED";
                statusOff = "-";
              }
            } catch (err) {
              console.error(
                `⚠️ Error calculating shift status for ${emp.nik}:`,
                err.message,
              );
            }
          }
        } else {
          status = "NO SHIFT ATTACHED";
          statusOff = "-";
        }

        // 4. Upsert into summary
        await pool.query(
          `INSERT INTO attendance_summary (nik, attendance_date, clock_in, clock_out, status, status_off, face_log_count, shift_name, shift_code, shift_start_time, shift_end_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             clock_in = VALUES(clock_in), 
             clock_out = VALUES(clock_out), 
             status = VALUES(status), 
             status_off = VALUES(status_off),
             face_log_count = VALUES(face_log_count),
             shift_name = VALUES(shift_name),
             shift_code = VALUES(shift_code),
              shift_start_time = VALUES(shift_start_time),
              shift_end_time = VALUES(shift_end_time)`,
          [
            emp.nik,
            targetDate,
            clockIn,
            clockOut,
            status,
            statusOff,
            faceLogCount,
            usedShiftName,
            usedShiftCode,
            usedShiftStart,
            usedShiftEnd,
          ],
        );
        totalSynced++;
      }
    }

    res.json({
      success: true,
      message: `Sync completed. ${totalSynced} records updated.`,
    });
  } catch (error) {
    console.error("❌ Sync attendance summary error:", error);
    res.status(500).json({ error: "Gagal melakukan sinkronisasi data" });
  }
};

/**
 * GET DASHBOARD STATS
 * Returns summary and trend data for RFID Dashboard
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const pool = getPool();

    // Calculate previous period
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive days

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);

    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (diffDays - 1));

    const prevStartDate = prevStart.toISOString().split("T")[0];
    const prevEndDate = prevEnd.toISOString().split("T")[0];

    // 1. Get total active employees
    const [empRows] = await pool.query(
      "SELECT COUNT(*) as total FROM employees WHERE deleted_at IS NULL",
    );
    const totalEmployees = empRows[0].total;

    // 2. Get attendance summary data within range
    const [summaryRows] = await pool.query(
      `SELECT status, status_off, attendance_date 
       FROM attendance_summary 
       WHERE attendance_date BETWEEN ? AND ?`,
      [startDate, endDate],
    );

    // 2.5 Get attendance summary data for PREVIOUS range
    const [prevSummaryRows] = await pool.query(
      `SELECT status, status_off 
       FROM attendance_summary 
       WHERE attendance_date BETWEEN ? AND ?`,
      [prevStartDate, prevEndDate],
    );

    // 3. Process CURRENT statistics
    let totalTap = summaryRows.length;
    let lateCount = 0;
    let earlyOutCount = 0;

    const trendMap = {}; // date -> { total, late, earlyOut }
    const statusDistribution = {
      "ON TIME": 0,
      LATE: 0,
      EARLY: 0,
      OTHER: 0,
    };

    summaryRows.forEach((row) => {
      let dateStr = "";
      if (row.attendance_date instanceof Date) {
        dateStr = row.attendance_date.toISOString().split("T")[0];
      } else {
        dateStr = String(row.attendance_date).split(" ")[0];
      }

      if (!trendMap[dateStr]) {
        trendMap[dateStr] = { date: dateStr, total: 0, late: 0, earlyOut: 0 };
      }

      trendMap[dateStr].total++;

      if (row.status?.includes("Late")) {
        lateCount++;
        trendMap[dateStr].late++;
        statusDistribution["LATE"]++;
      } else if (
        row.status?.includes("Early Check In") ||
        row.status === "ON TIME"
      ) {
        statusDistribution["ON TIME"]++;
      } else {
        statusDistribution["OTHER"]++;
      }

      if (row.status_off?.includes("Early Check Out")) {
        earlyOutCount++;
        trendMap[dateStr].earlyOut++;
      }
    });

    // 4. Process PREVIOUS statistics
    let prevTotalTap = prevSummaryRows.length;
    let prevLateCount = 0;
    let prevEarlyOutCount = 0;

    prevSummaryRows.forEach((row) => {
      if (row.status?.includes("Late")) prevLateCount++;
      if (row.status_off?.includes("Early Check Out")) prevEarlyOutCount++;
    });

    // Convert trendMap to sorted array
    const trendData = Object.values(trendMap).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // Format distribution for PieChart
    const distributionData = Object.keys(statusDistribution).map((key) => ({
      name: key,
      value: statusDistribution[key],
    }));

    res.json({
      summary: {
        totalEmployees,
        totalTap,
        lateCount,
        earlyOutCount,
      },
      prevSummary: {
        totalEmployees, // Usually relatively static or we can just pass the same
        totalTap: prevTotalTap,
        lateCount: prevLateCount,
        earlyOutCount: prevEarlyOutCount,
      },
      trendData,
      distributionData,
    });
  } catch (error) {
    console.error("❌ Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard statistics" });
  }
};

/**
 * 🤳 Get Face Log details for modal
 */
export const getFaceLogDetails = async (req, res) => {
  try {
    const { nik, date } = req.query;
    const pool = getPool();

    const [rows] = await pool.query(
      `SELECT attendance_time, picture, is_matched, created_at
       FROM attendance_log
       WHERE nik = ? AND attendance_date = ?
       ORDER BY attendance_time ASC`,
      [nik, date],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Get face log details error:", error);
    res.status(500).json({ error: "Gagal mengambil detail face log" });
  }
};
