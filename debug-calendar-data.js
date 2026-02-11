// Debug Calendar Data
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const debugCalendar = async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "e-connect_db",
      port: process.env.DB_PORT || 3306,
    });

    console.log("📅 Fetching Feb 2026 events...");

    // Check all events for Feb 2026
    const [rows] = await connection.query(
      `SELECT * FROM work_calendar 
       WHERE YEAR(date) = 2026 AND MONTH(date) = 2`,
    );

    console.log(`Found ${rows.length} events:`);
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    if (connection) await connection.end();
  }
};

debugCalendar();
