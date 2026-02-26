import { initDatabase } from "./src/config/database.js";

async function investigate() {
  try {
    const pool = await initDatabase();

    console.log("--- Column types for attendance_summary ---");
    const [summaryCols] = await pool.query(
      "SHOW COLUMNS FROM attendance_summary",
    );
    console.log(JSON.stringify(summaryCols, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

investigate();
