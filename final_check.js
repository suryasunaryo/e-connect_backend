import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "e-connect_db",
    port: process.env.DB_PORT || 3306,
  });

  const [rows] = await connection.execute("DESCRIBE users");
  console.log("USERS_SCHEMA:", JSON.stringify(rows, null, 2));
  await connection.end();
}

checkSchema().catch(console.error);
