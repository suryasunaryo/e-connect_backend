import { dbHelpers, initDatabase } from "../config/database.js";

const migrate = async () => {
  try {
    await initDatabase();
    console.log(
      "🚀 Starting migration: Adding is_online and last_activity columns...",
    );

    // 1. Add is_online to users table
    const isOnlineCol = await dbHelpers.query(
      "SHOW COLUMNS FROM users LIKE 'is_online'",
    );
    if (isOnlineCol.length === 0) {
      await dbHelpers.execute(
        "ALTER TABLE users ADD COLUMN is_online TINYINT(1) DEFAULT 0 AFTER phone",
      );
      console.log("✅ Added is_online to 'users' table");
    } else {
      console.log("ℹ️ is_online already exists in 'users' table");
    }

    // 2. Add last_activity to users table
    const lastActivityCol = await dbHelpers.query(
      "SHOW COLUMNS FROM users LIKE 'last_activity'",
    );
    if (lastActivityCol.length === 0) {
      await dbHelpers.execute(
        "ALTER TABLE users ADD COLUMN last_activity DATETIME NULL AFTER is_online",
      );
      console.log("✅ Added last_activity to 'users' table");
    } else {
      console.log("ℹ️ last_activity already exists in 'users' table");
    }

    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
};

migrate();
