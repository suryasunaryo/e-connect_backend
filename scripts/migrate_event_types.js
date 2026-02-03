import { getPool, initDatabase } from "../src/config/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
  try {
    await initDatabase();
    const pool = getPool();
    const connection = await pool.getConnection();

    console.log("Reading migration file...");
    const migrationPath = path.join(
      __dirname,
      "../migrations/create_calendar_event_types.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Found ${statements.length} statements to execute.`);

    for (const statement of statements) {
      console.log("Executing:", statement.substring(0, 50) + "...");
      await connection.query(statement);
    }

    console.log("Migration completed successfully.");
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
