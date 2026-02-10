import { getPool } from "./src/config/database.js";
import { initDatabase } from "./src/config/database.js";

(async () => {
  try {
    console.log("Initializing database...");
    await initDatabase();

    console.log("Getting pool...");
    const pool = getPool();

    console.log("Executing query...");
    const [rows] = await pool.query(`
      SELECT aes.*, e.full_name, s.shift_name 
      FROM attendance_employee_shift aes
      LEFT JOIN employees e ON aes.target_type = 'user' AND (aes.target_value = e.id OR aes.target_value = e.nik)
      LEFT JOIN attendance_shifts s ON aes.shift_id = s.shift_id
      WHERE aes.is_deleted IS NULL OR aes.is_deleted = 0
    `);

    console.log("SUCCESS! Rows found:", rows.length);
    if (rows.length > 0) {
      console.log("Sample row:", JSON.stringify(rows[0], null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error("ERROR:", err);
    console.error("Stack:", err.stack);
    process.exit(1);
  }
})();
