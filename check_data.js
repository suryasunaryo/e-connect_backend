import { dbHelpers, initDatabase } from "./src/config/database.js";

async function checkData() {
  try {
    await initDatabase();
    const rows = await dbHelpers.query(
      "SELECT id, nik, is_matched FROM attendance_log ORDER BY id DESC LIMIT 5",
    );
    console.log("📊 Latest 5 rows in attendance_log:");
    console.table(rows);
  } catch (error) {
    console.error("❌ Error checking data:", error);
  } finally {
    process.exit();
  }
}

checkData();
