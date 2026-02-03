import { initDatabase, getPool } from "../src/config/database.js";
import bcrypt from "bcryptjs";

const resetPassword = async () => {
  try {
    await initDatabase();
    const pool = getPool();
    const hash = bcrypt.hashSync("admin123", 10);
    await pool.execute(
      "UPDATE users SET password = ? WHERE username = 'admin'",
      [hash]
    );
    console.log("Password for admin reset to admin123");
    process.exit(0);
  } catch (error) {
    console.error("Error resetting password:", error);
    process.exit(1);
  }
};

resetPassword();
