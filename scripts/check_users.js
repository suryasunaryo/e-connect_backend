import { initDatabase, getPool } from "../src/config/database.js";

const checkUsers = async () => {
  try {
    await initDatabase();
    const pool = getPool();
    const [users] = await pool.query(
      "SELECT id, username, role, is_active FROM users"
    );
    console.log("Users:", users);
    process.exit(0);
  } catch (error) {
    console.error("Error checking users:", error);
    process.exit(1);
  }
};

checkUsers();
