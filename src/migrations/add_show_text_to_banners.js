import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "e-connect_db",
  port: process.env.DB_PORT || 3306,
};

async function migrate() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    console.log("Checking for show_text column in banners table...");
    const [cols] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'banners' AND COLUMN_NAME = 'show_text'",
      [dbConfig.database],
    );

    if (cols[0].count === 0) {
      console.log("Adding show_text column to banners table...");
      await connection.execute(
        "ALTER TABLE banners ADD COLUMN show_text TINYINT(1) DEFAULT 1 AFTER description",
      );
      console.log("✅ show_text column added successfully.");
    } else {
      console.log("✅ show_text column already exists.");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
  } finally {
    await connection.end();
  }
}

migrate();
