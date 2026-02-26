import mysql from "mysql2/promise";

async function test() {
  const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "e-connect_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  try {
    const [rows] = await pool.query(
      "SELECT COUNT(*) as count FROM attendance_summary",
    );
    console.log("Total records in attendance_summary:", rows[0].count);

    const [rows2] = await pool.query(
      "SELECT MIN(attendance_date) as minDate, MAX(attendance_date) as maxDate FROM attendance_summary",
    );
    console.log("Date range:", rows2[0]);

    const [rows3] = await pool.query(
      "SELECT * FROM attendance_summary LIMIT 5",
    );
    console.log("Sample records:", rows3);
  } catch (err) {
    console.error("Database error:", err);
  } finally {
    await pool.end();
  }
}

test();
