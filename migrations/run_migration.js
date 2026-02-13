import { dbHelpers, initDatabase } from "../src/config/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
  try {
    await initDatabase(); // Initialize DB connection

    const fileName = process.argv[2] || "fix_target_type_column.sql";
    const migrationPath = path.join(__dirname, fileName);
    const sql = fs.readFileSync(migrationPath, "utf8");

    console.log("Running migration from:", migrationPath);

    await dbHelpers.execute(sql);

    console.log("✅ Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("⚠️ Columns already exist. Skipping.");
      process.exit(0);
    }
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
