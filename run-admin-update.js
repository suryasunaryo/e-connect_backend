// Run admin preferences update
import mysql from "mysql2/promise";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const runUpdate = async () => {
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
    console.log("📄 Reading update script...");

    const updateSQL = fs.readFileSync(
      "./migrations/UPDATE_ADMIN_PREFERENCES.sql",
      "utf8",
    );

    console.log("🚀 Executing update...");

    await connection.query(updateSQL);

    console.log("✅ Admin preferences reset successfully!");
  } catch (error) {
    console.error("❌ Update failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("✅ Database connection closed");
    }
  }
};

runUpdate();
