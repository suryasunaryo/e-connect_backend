import { initDatabase, getPool } from "./src/config/database.js";

async function runMigration() {
  try {
    await initDatabase();
    const pool = getPool();
    const connection = await pool.getConnection();

    console.log("🔄 Running migration: adding is_matched to attendance_log...");

    const [cols] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = (SELECT DATABASE()) AND TABLE_NAME = 'attendance_log' AND COLUMN_NAME = 'is_matched'",
    );

    if (cols[0].count === 0) {
      await connection.execute(
        "ALTER TABLE attendance_log ADD COLUMN is_matched TINYINT(1) DEFAULT NULL AFTER attendance_time",
      );
      console.log("✅ Column 'is_matched' added successfully.");
    } else {
      console.log("ℹ️ Column 'is_matched' already exists.");
    }

    connection.release();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
