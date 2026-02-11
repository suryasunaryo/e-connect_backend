// Run database migration for dashboard layout
import mysql from "mysql2/promise";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const runMigration = async () => {
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
    console.log("📄 Reading migration file...");

    const migrationSQL = fs.readFileSync(
      "./migrations/MIGRATION_DASHBOARD_LAYOUT.sql",
      "utf8",
    );

    console.log("🚀 Executing migration...");

    await connection.query(migrationSQL);

    console.log("✅ Migration completed successfully!");
    console.log("\n📊 Verifying dashboard cards...");

    const [cards] = await connection.query(
      "SELECT card_key, card_name, default_visible, display_order FROM dashboard_cards ORDER BY display_order",
    );

    console.log("\nDashboard Cards:");
    console.table(cards);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("\n✅ Database connection closed");
    }
  }
};

runMigration();
