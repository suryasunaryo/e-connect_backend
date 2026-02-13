import { dbHelpers, initDatabase } from "./src/config/database.js";
import fs from "fs";

async function checkSchema() {
  try {
    await initDatabase();
    const columns = await dbHelpers.query("DESCRIBE users");
    let output = "✅ Columns found in 'users' table:\n";
    columns.forEach((col) => {
      output += `- ${col.Field} (${col.Type})\n`;
    });

    const hasField = columns.some(
      (col) => col.Field === "bypass_face_detection",
    );
    if (hasField) {
      output += "\n🚀 SUCCESS: 'bypass_face_detection' column EXISTS.";
    } else {
      output += "\n❌ ERROR: 'bypass_face_detection' column is MISSING.";
    }
    fs.writeFileSync("schema_result.txt", output);
  } catch (error) {
    fs.writeFileSync("schema_result.txt", "❌ Error: " + error.message);
  } finally {
    process.exit();
  }
}

checkSchema();
