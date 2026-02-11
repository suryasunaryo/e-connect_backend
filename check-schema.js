// Check table schema
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const checkSchema = async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "e-connect_db",
      port: process.env.DB_PORT || 3306,
    });

    console.log("📅 Fetching schema...");

    // Use stored procedure or simple describe
    const [rows] = await connection.query(`DESCRIBE work_calendar`);
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    if (connection) await connection.end();
  }
};

checkSchema();
