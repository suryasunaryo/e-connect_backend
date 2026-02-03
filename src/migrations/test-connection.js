import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const testConnection = async () => {
  console.log("🧪 Testing MySQL Connection...");

  const config = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "truck_queue_system",
  };

  try {
    const connection = await mysql.createConnection(config);
    console.log("✅ MySQL Connection: SUCCESS");

    // Test query
    const [rows] = await connection.execute("SELECT 1 + 1 as result");
    console.log("✅ Test Query: SUCCESS", rows[0]);

    await connection.end();
    return true;
  } catch (error) {
    console.error("❌ MySQL Connection: FAILED");
    console.error("Error:", error.message);
    console.error("Code:", error.code);

    if (error.code === "ER_ACCESS_DENIED_ERROR") {
      console.log("\n💡 Access Denied - Check:");
      console.log("   - MySQL username/password in .env file");
      console.log("   - User privileges in MySQL");
    } else if (error.code === "ECONNREFUSED") {
      console.log("\n💡 Connection Refused - Check:");
      console.log("   - MySQL server is running");
      console.log("   - Host and port in .env file");
    } else if (error.code === "ER_BAD_DB_ERROR") {
      console.log("\n💡 Database Error - Check:");
      console.log("   - Database exists in MySQL");
      console.log("   - Database name in .env file");
    }

    return false;
  }
};

testConnection();
