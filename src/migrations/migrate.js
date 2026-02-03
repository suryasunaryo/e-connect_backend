import { initDatabase, closeDatabase } from "../config/database.js";

/**
 * Database migration script for MySQL
 */
const runMigration = async () => {
  console.log("🚀 Starting MySQL database migration...");
  console.log("📊 Database Configuration:");
  console.log(`   Host: ${process.env.DB_HOST || "localhost"}`);
  console.log(`   Port: ${process.env.DB_PORT || 3306}`);
  console.log(`   Database: ${process.env.DB_NAME || "e-connect_db"}`);
  console.log(`   User: ${process.env.DB_USER || "root"}`);

  try {
    await initDatabase();
    console.log("✅ MySQL database migration completed successfully");
  } catch (error) {
    console.error("❌ MySQL database migration failed:");
    console.error("   Error:", error.message);

    // Provide helpful error messages
    if (error.code === "ER_ACCESS_DENIED_ERROR") {
      console.error(
        "💡 Solution: Check MySQL username and password in .env file"
      );
    } else if (error.code === "ECONNREFUSED") {
      console.error("💡 Solution: Make sure MySQL server is running");
    } else if (error.code === "ER_BAD_DB_ERROR") {
      console.error("💡 Solution: Check database name and permissions");
    }

    process.exit(1);
  } finally {
    await closeDatabase();
    process.exit(0);
  }
};

// Run migration
runMigration();
