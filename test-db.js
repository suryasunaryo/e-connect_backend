import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

async function check() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const [rows] = await pool.query(
      'SHOW COLUMNS FROM users WHERE Field IN ("email", "username")',
    );
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();
