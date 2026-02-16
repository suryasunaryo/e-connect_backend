import { dbHelpers, initDatabase } from "./src/config/database.js";

async function checkEmployee() {
  try {
    await initDatabase();
    const rows = await dbHelpers.query(
      "SELECT nik, full_name, picture FROM employees WHERE nik = '2019149'",
    );
    console.log("👤 Employee data for NIK 2019149:");
    console.table(rows);
  } catch (error) {
    console.error("❌ Error checking employee:", error);
  } finally {
    process.exit();
  }
}

checkEmployee();
