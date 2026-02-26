import { initDatabase } from "./src/config/database.js";

async function testFullSync() {
  try {
    const pool = await initDatabase();

    // Simulate req.body
    const startDate = "2026-02-23";
    const endDate = "2026-02-24";

    let targetDates = [];
    let start = new Date(startDate);
    let end = new Date(endDate);
    while (start <= end) {
      targetDates.push(start.toISOString().split("T")[0]);
      start.setDate(start.getDate() + 1);
    }

    for (const targetDate of targetDates) {
      const [allLogs] = await pool.query(
        `SELECT nik, attendance_time, is_matched FROM attendance_log WHERE attendance_date = ?`,
        [targetDate],
      );

      console.log(`📡 Date ${targetDate}: Found ${allLogs.length} logs`);
      if (allLogs.length === 0) continue;

      const logsByNik = allLogs.reduce((acc, log) => {
        if (!acc[log.nik]) acc[log.nik] = [];
        acc[log.nik].push(log);
        return acc;
      }, {});

      const niks = Object.keys(logsByNik);
      const [employees] = await pool.query(
        `SELECT id, nik, employee_shift_id FROM employees WHERE nik IN (?)`,
        [niks],
      );

      for (const emp of employees) {
        const empLogs = logsByNik[emp.nik];
        const clockIn = empLogs.reduce(
          (min, log) => (log.attendance_time < min ? log.attendance_time : min),
          empLogs[0].attendance_time,
        );
        const clockOut = empLogs.reduce(
          (max, log) => (log.attendance_time > max ? log.attendance_time : max),
          empLogs[0].attendance_time,
        );
        const faceLogCount = empLogs.length;

        console.log(`💾 Upserting for ${emp.nik} on ${targetDate}...`);
        try {
          await pool.query(
            `INSERT INTO attendance_summary (nik, attendance_date, clock_in, clock_out, status, face_log_count, shift_name)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE 
                 clock_in = VALUES(clock_in), 
                 clock_out = VALUES(clock_out), 
                 status = VALUES(status), 
                 face_log_count = VALUES(face_log_count),
                 shift_name = VALUES(shift_name)`,
            [
              emp.nik,
              targetDate,
              clockIn,
              clockOut,
              "TEST STATUS",
              faceLogCount,
              "TEST SHIFT",
            ],
          );
          console.log(`✅ Success for ${emp.nik}`);
        } catch (e) {
          console.error(`❌ FAILED for ${emp.nik}:`, e.message);
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error("CRITICAL ERROR:", err);
    process.exit(1);
  }
}

testFullSync();
