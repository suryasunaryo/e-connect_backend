import { initDatabase, getPool } from "../src/config/database.js";

const checkSchema = async () => {
  try {
    await initDatabase();
    const pool = getPool();
    const [columns] = await pool.query("DESCRIBE employees");
    console.log("Employees Table Schema:", columns);
    process.exit(0);
  } catch (error) {
    console.error("Error checking schema:", error);
    process.exit(1);
  }
};

checkSchema();
