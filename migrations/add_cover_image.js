import {
  dbHelpers,
  initDatabase,
  closeDatabase,
} from "../src/config/database.js";

const runMigration = async () => {
  try {
    await initDatabase();
    console.log("Checking if cover_image column exists...");

    // Check if column exists
    const checkSql = `
      SELECT COUNT(*) as count 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME || "e-connect_db"}' 
      AND TABLE_NAME = 'news' 
      AND COLUMN_NAME = 'cover_image'
    `;

    const result = await dbHelpers.queryOne(checkSql);

    if (result.count == 0) {
      console.log("Adding cover_image column...");
      await dbHelpers.execute(
        "ALTER TABLE news ADD COLUMN cover_image VARCHAR(255) NULL AFTER category"
      );
      console.log("✅ success: cover_image column added.");
    } else {
      console.log("ℹ️ cover_image column already exists.");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await closeDatabase();
    process.exit(0);
  }
};

runMigration();
