import { initDatabase } from "./src/config/database.js";

async function testFriday() {
  try {
    const pool = await initDatabase();

    // Friday, Feb 27
    const targetDate = "2026-02-27";
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const d = new Date(targetDate);
    const dayOfWeekStr = dayNames[d.getUTCDay()];
    console.log(`Target Date: ${targetDate} -> Day Name: ${dayOfWeekStr}`);

    const [surya] = await pool.query(
      "SELECT nik, employee_shift_id FROM employees WHERE nik = '2019149'",
    );
    const shiftIds = String(surya[0].employee_shift_id).split(",");

    const [shifts] = await pool.query(
      "SELECT * FROM attendance_shifts WHERE shift_id IN (?)",
      [shiftIds],
    );

    const activeShift = shifts.find((s) => {
      const workDays =
        typeof s.work_days === "string" ? JSON.parse(s.work_days) : s.work_days;
      return Array.isArray(workDays) && workDays.includes(dayOfWeekStr);
    });

    if (activeShift) {
      console.log(`✅ Success! Found: ${activeShift.shift_name}`);
    } else {
      console.log(`❌ Failed. No active shift found for ${dayOfWeekStr}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testFriday();
