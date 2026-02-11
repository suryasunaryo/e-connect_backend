// Run sync preferences script
import mysql from "mysql2/promise";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const runSync = async () => {
  let connection;

  try {
    console.log("🔄 Connecting to database...");

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "e-connect_db",
      port: process.env.DB_PORT || 3306,
      multipleStatements: true,
    });

    console.log("✅ Connected to database");
    console.log("📄 Reading sync script...");

    const syncSQL = fs.readFileSync(
      "./migrations/SYNC_MISSING_PREFERENCES.sql",
      "utf8",
    );

    console.log("🚀 Executing sync...");

    // Execute the query. mysql2 returns [rows, fields]
    // For INSERT, rows contains details like affectedRows
    const [result] = await connection.query(syncSQL);

    console.log("✅ Preferences synced successfully!");
    console.log("Affected rows:", result.affectedRows);
  } catch (error) {
    console.error("❌ Sync failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("✅ Database connection closed");
    }
  }
};

runSync();
