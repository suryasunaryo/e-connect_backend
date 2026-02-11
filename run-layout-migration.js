import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "e-connect_db",
      port: process.env.DB_PORT || 3306,
      multipleStatements: true,
    });

    console.log("🚀 Running migration: ADD_LAYOUT_COLUMNS.sql");

    const sqlPath = path.join(
      __dirname,
      "migrations",
      "ADD_LAYOUT_COLUMNS.sql",
    );
    const sql = fs.readFileSync(sqlPath, "utf8");

    await connection.query(sql);

    console.log("✅ Migration successful! Columns added.");
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("⚠️ Columns already exist, skipping migration.");
    } else {
      console.error("❌ Migration failed:", error.message);
    }
  } finally {
    if (connection) await connection.end();
  }
};

runMigration();
