import { dbHelpers, initDatabase } from "./src/config/database.js";
import fs from "fs";

async function verifyMigration() {
  try {
    console.log("🔍 Verifying attendance_log schema...");
    await initDatabase();
    const columns = await dbHelpers.query("DESCRIBE attendance_log");

    let output = "📋 Current attendance_log columns:\n";
    columns.forEach((col) => {
      output += `- ${col.Field} (${col.Type})\n`;
    });

    const isMatchedExists = columns.some((col) => col.Field === "is_matched");
    if (isMatchedExists) {
      output += "\n✅ SUCCESS: 'is_matched' column exists.";
    } else {
      output += "\n❌ FAILED: 'is_matched' column is missing.";
    }

    console.log(output);
    fs.writeFileSync("migration_verify_result.txt", output);
  } catch (error) {
    console.error("❌ Error during verification:", error);
    fs.writeFileSync(
      "migration_verify_result.txt",
      "❌ Error: " + error.message,
    );
  } finally {
    process.exit();
  }
}

verifyMigration();
