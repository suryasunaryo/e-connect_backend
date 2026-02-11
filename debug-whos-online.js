// Debug Who's Online Query
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const debugWhosOnline = async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "e-connect_db",
      port: process.env.DB_PORT || 3306,
    });

    console.log("🔍 Checking users table columns...");
    const [userCols] = await connection.query(`DESCRIBE users`);
    console.log("Users columns:", userCols.map((c) => c.Field).join(", "));

    console.log("🔍 Running getWhosOnline query...");
    const [rows] = await connection.query(
      `SELECT 
        u.id,
        u.full_name,
        u.email,
        u.picture,
        u.last_activity,
        e.position_id,
        e.department_id,
        p.position_name,
        d.dept_name as department_name
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE u.deleted_at IS NULL
        AND u.is_active = 1
      LIMIT 5`,
      // Removed last_activity constraint to check if query structure is valid
    );
    console.log("✅ Query success. Rows:", rows.length);
  } catch (error) {
    console.error("❌ Query Failed:", error.message);
  } finally {
    if (connection) await connection.end();
  }
};

debugWhosOnline();
