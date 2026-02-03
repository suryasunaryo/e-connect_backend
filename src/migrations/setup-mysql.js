import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

/**
 * Manual MySQL database setup script
 * Run this if automatic migration fails
 */
const setupMySQL = async () => {
  console.log("🔧 Manual MySQL Database Setup");

  const config = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  };

  try {
    // Connect to MySQL without database
    const connection = await mysql.createConnection(config);
    console.log("✅ Connected to MySQL server");

    const dbName = process.env.DB_NAME || "truck_queue_system";

    // Create database
    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`✅ Database '${dbName}' created`);

    // Switch to database
    await connection.execute(`USE \`${dbName}\``);

    // Create tables
    const tables = [
      `CREATE TABLE IF NOT EXISTS trucks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        license_plate VARCHAR(20) NOT NULL UNIQUE,
        driver_name VARCHAR(100) NOT NULL,
        destination VARCHAR(200) NOT NULL,
        document_number VARCHAR(100),
        status ENUM('scheduled', 'checked_in', 'checked_out') DEFAULT 'scheduled',
        scheduled_time DATETIME NOT NULL,
        check_in_time DATETIME NULL,
        check_out_time DATETIME NULL,
        duration_minutes INT NULL,
        photo_path VARCHAR(500) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'operator') DEFAULT 'operator',
        full_name VARCHAR(100),
        email VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        last_login DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        action VARCHAR(50) NOT NULL,
        table_name VARCHAR(50) NOT NULL,
        record_id INT NULL,
        old_values JSON NULL,
        new_values JSON NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    ];

    for (const tableSql of tables) {
      await connection.execute(tableSql);
    }
    console.log("✅ All tables created successfully");

    // Create indexes
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_trucks_status ON trucks(status)",
      "CREATE INDEX IF NOT EXISTS idx_trucks_license_plate ON trucks(license_plate)",
      "CREATE INDEX IF NOT EXISTS idx_trucks_scheduled_time ON trucks(scheduled_time)",
      "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
      "CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)",
    ];

    for (const indexSql of indexes) {
      await connection.execute(indexSql);
    }
    console.log("✅ All indexes created successfully");

    await connection.end();
    console.log("🎉 Manual database setup completed successfully!");
  } catch (error) {
    console.error("❌ Manual setup failed:", error.message);

    if (error.code === "ER_ACCESS_DENIED_ERROR") {
      console.log("\n💡 Tips:");
      console.log("1. Pastikan MySQL server sedang berjalan");
      console.log("2. Periksa username dan password MySQL di file .env");
      console.log("3. Jika menggunakan XAMPP/WAMP, password biasanya kosong");
      console.log("4. Coba koneksi manual: mysql -u root -p");
    }

    process.exit(1);
  }
};

// Run setup
setupMySQL();
