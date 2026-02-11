// Run add widgets migration
import mysql from "mysql2/promise";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const runAddWidgets = async () => {
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
    console.log("📄 Reading migration script...");

    const migrationSQL = fs.readFileSync(
      "./migrations/ADD_NEW_WIDGETS.sql",
      "utf8",
    );

    console.log("🚀 Executing migration...");

    const [result] = await connection.query(migrationSQL);

    console.log("✅ New widgets added and synced successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("✅ Database connection closed");
    }
  }
};

runAddWidgets();
