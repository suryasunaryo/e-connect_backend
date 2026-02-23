import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "e-connect_db",
      port: process.env.DB_PORT || 3306,
    });

    console.log("Updating news_targets schema...");
    await connection.execute(
      "ALTER TABLE news_targets MODIFY COLUMN target_type ENUM('all', 'department', 'branch', 'position', 'role', 'user') NOT NULL",
    );
    console.log("✅ news_targets schema updated successfully");

    await connection.end();
  } catch (err) {
    console.error("❌ Error updating news_targets schema:", err.message);
    process.exit(1);
  }
}

run();
