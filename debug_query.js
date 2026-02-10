const mysql = require("mysql2/promise");
require("dotenv").config({ path: ".env" });

(async () => {
  try {
    console.log("Connecting to database...");
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
    });

    console.log("Executing query...");
    const [rows] = await conn.execute(`
      SELECT aes.*, e.full_name, s.shift_name 
      FROM attendance_employee_shift aes
      LEFT JOIN employees e ON aes.target_type = 'user' AND (aes.target_value = e.id OR aes.target_value = e.nik)
      LEFT JOIN attendance_shifts s ON aes.shift_id = s.shift_id
      WHERE aes.is_deleted IS NULL OR aes.is_deleted = 0
    `);

    console.log("Rows found:", rows.length);
    if (rows.length > 0) {
      console.log("Sample row:", JSON.stringify(rows[0], null, 2));
    }

    await conn.end();
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  }
})();
