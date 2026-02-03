import dotenv from "dotenv";
import { initDatabase, dbHelpers } from "./src/config/database.js";

dotenv.config();

async function migrate() {
  try {
    console.log("🔄 Initializing database...");
    await initDatabase();

    console.log("🛠️ Altering 'users' table schema...");
    // Change role column from ENUM to VARCHAR(50) to support dynamic role IDs
    await dbHelpers.execute(
      "ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user'"
    );

    console.log("✅ Successfully updated 'role' column to VARCHAR(50)");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
