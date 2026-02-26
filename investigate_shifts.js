import { initDatabase } from "./src/config/database.js";

async function investigate() {
  try {
    const pool = await initDatabase();

    console.log("--- attendance_shifts ---");
    const [shifts] = await pool.query("SELECT * FROM attendance_shifts");
    console.log(JSON.stringify(shifts, null, 2));

    console.log("--- employee shift ids ---");
    const [empShifts] = await pool.query(
      "SELECT nik, full_name, employee_shift_id FROM employees WHERE employee_shift_id IS NOT NULL LIMIT 10",
    );
    console.log(JSON.stringify(empShifts, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

investigate();
