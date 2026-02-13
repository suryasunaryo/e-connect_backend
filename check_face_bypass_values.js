import { dbHelpers, initDatabase } from "./src/config/database.js";
import fs from "fs";

async function checkValues() {
  try {
    await initDatabase();
    const users = await dbHelpers.query(
      "SELECT id, username, role, bypass_face_detection FROM users",
    );
    let output = "📊 User Settings:\n";
    users.forEach((u) => {
      output += `ID: ${u.id} | User: ${u.username} | Role: ${u.role} | Bypass: ${u.bypass_face_detection}\n`;
    });
    fs.writeFileSync("user_settings.txt", output);
    console.log("✅ Results written to user_settings.txt");
  } catch (error) {
    fs.writeFileSync("user_settings.txt", "❌ Error: " + error.message);
  } finally {
    process.exit();
  }
}

checkValues();
