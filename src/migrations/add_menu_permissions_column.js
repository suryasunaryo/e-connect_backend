import { dbHelpers, initDatabase } from "../config/database.js";

const migrate = async () => {
  try {
    await initDatabase();
    console.log("🚀 Starting migration: Adding menu_permissions column...");

    // 1. Add to users table
    const userCols = await dbHelpers.query(
      "SHOW COLUMNS FROM users LIKE 'menu_permissions'"
    );
    if (userCols.length === 0) {
      await dbHelpers.execute(
        "ALTER TABLE users ADD COLUMN menu_permissions JSON NULL AFTER menu_access"
      );
      console.log("✅ Added menu_permissions to 'users' table");
    } else {
      console.log("ℹ️ menu_permissions already exists in 'users' table");
    }

    // 2. Add to users_role table
    const roleCols = await dbHelpers.query(
      "SHOW COLUMNS FROM users_role LIKE 'menu_permissions'"
    );
    if (roleCols.length === 0) {
      await dbHelpers.execute(
        "ALTER TABLE users_role ADD COLUMN menu_permissions JSON NULL AFTER menu_access"
      );
      console.log("✅ Added menu_permissions to 'users_role' table");
    } else {
      console.log("ℹ️ menu_permissions already exists in 'users_role' table");
    }

    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
};

migrate();
