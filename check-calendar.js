// Check work_calendar data
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const checkCalendar = async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "e-connect_db",
      port: process.env.DB_PORT || 3306,
    });

    console.log("📅 Fetching work_calendar entries...");

    const [rows] = await connection.query(
      `SELECT title, start, type, source, target_type 
       FROM work_calendar 
       ORDER BY start DESC 
       LIMIT 10`,
    );

    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    if (connection) await connection.end();
  }
};

checkCalendar();
