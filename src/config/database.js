// src/config/database.js
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "e-connect_db",
  port: process.env.DB_PORT || 3306,
  timezone: "+00:00",
  dateStrings: true,
  charset: "utf8mb4",
};

let pool = null;

/**
 * 🔧 Initialize MySQL Connection Pool
 */
export const initDatabase = async () => {
  try {
    console.log("🔄 Connecting to MySQL...");
    const tempConfig = { ...dbConfig };
    delete tempConfig.database;

    const tempConn = await mysql.createConnection(tempConfig);
    await tempConn.execute(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await tempConn.end();

    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
      queueLimit: 0,
    });

    const conn = await pool.getConnection();
    await conn.query("SELECT 1");
    conn.release();
    console.log("✅ MySQL connection established successfully");

    await createTablesIfNeeded(pool);
    return pool;
  } catch (error) {
    console.error("❌ Database initialization failed:", error.message);
    pool = null;
    throw error;
  }
};

const createTablesIfNeeded = async (pool) => {
  const connection = await pool.getConnection();
  try {
    // Check if activity_logs table exists
    const [activityLogsTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'activity_logs'",
      [dbConfig.database],
    );

    if (activityLogsTable[0].count === 0) {
      console.log("📋 Creating activity_logs table...");

      await connection.execute(`
        CREATE TABLE activity_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NULL,
          action VARCHAR(50) NOT NULL,
          table_name VARCHAR(100) NOT NULL,
          record_id INT NULL,
          old_values JSON NULL,
          new_values JSON NULL,
          ip_address VARCHAR(100) NULL,
          user_agent TEXT NULL,
          description TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_action (action),
          INDEX idx_table_name (table_name),
          INDEX idx_created_at (created_at),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      console.log("✅ activity_logs table created successfully");
    }

    // Check and create other tables if needed
    const [usersTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
      [dbConfig.database],
    );

    if (usersTable[0].count === 0) {
      console.log("📋 Creating users table...");

      await connection.execute(`
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role ENUM('admin','operator','viewer') DEFAULT 'operator',
          full_name VARCHAR(100),
          email VARCHAR(100),
          is_active BOOLEAN DEFAULT TRUE,
          last_login DATETIME NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await connection.execute(`
        CREATE TABLE trucks (
          id INT AUTO_INCREMENT PRIMARY KEY,
          license_plate VARCHAR(50) NOT NULL,
          truck_asal VARCHAR(255),
          driver_name VARCHAR(100) NOT NULL,
          driver_phone VARCHAR(50),
          driver_license VARCHAR(100),
          destination VARCHAR(255) NOT NULL,
          document_number VARCHAR(100),
          status ENUM('scheduled','checked_in','loading','loaded','checked_out','cancelled') DEFAULT 'scheduled',
          scheduled_time DATETIME NOT NULL,
          check_in_time DATETIME NULL,
          loading_start_time DATETIME NULL,
          loading_end_time DATETIME NULL,
          check_out_time DATETIME NULL,
          duration_minutes INT NULL,
          estimated_duration INT NULL,
          photo_path TEXT NULL,
          truck_photos TEXT NULL,
          document_photos TEXT NULL,
          other_photos TEXT NULL,
          document_number_out VARCHAR(100) NULL,
          truck_photos_out TEXT NULL,
          document_photos_out TEXT NULL,
          other_photos_out TEXT NULL,
          notes_out TEXT NULL,
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      const bcrypt = await import("bcryptjs");
      const hash = bcrypt.hashSync("admin123", 10);
      await connection.execute(
        "INSERT INTO users (username, password, role, full_name, email, is_active) VALUES (?,?,?,?,?,?)",
        [
          "admin",
          hash,
          "admin",
          "System Administrator",
          "admin@company.com",
          1,
        ],
      );

      console.log("✅ Tables created, default admin (admin/admin123) added");
    }

    // ---------------------------------------------------------
    // MIGRATION / INITIALIZATION: users_role table
    // ---------------------------------------------------------
    const [usersRoleTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users_role'",
      [dbConfig.database],
    );

    if (usersRoleTable[0].count === 0) {
      console.log("📋 Creating users_role table...");
      await connection.execute(`
        CREATE TABLE users_role (
          id INT AUTO_INCREMENT PRIMARY KEY,
          role_id VARCHAR(50) NOT NULL,
          role_name VARCHAR(255),
          menu_groups VARCHAR(255),
          menu_access VARCHAR(255),
          menu_permissions JSON,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL,
          is_deleted INT DEFAULT 0,
          UNIQUE KEY (role_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Seed initial roles
      console.log("🌱 Seeding users_role table...");
      await connection.execute(`
        INSERT INTO users_role (role_id, role_name, is_active) VALUES 
        ('1', 'Admin', 1),
        ('2', 'Restricted User', 1),
        ('31', 'Default Role', 1)
      `);
      console.log("✅ users_role table created and seeded");
    }

    // Add role_id to users if it doesn't exist
    try {
      const [roleIdColCheck] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role_id'",
        [dbConfig.database],
      );
      if (roleIdColCheck[0].count === 0) {
        console.log("migrating: Adding role_id column to users table...");
        await connection.execute(
          "ALTER TABLE users ADD COLUMN role_id VARCHAR(50) NULL AFTER role",
        );
        // Set existing admin to role_id '1'
        await connection.execute(
          "UPDATE users SET role_id = '1' WHERE username = 'admin'",
        );
      }
    } catch (err) {
      console.warn("Migration warning (users.role_id):", err.message);
    }

    // ---------------------------------------------------------
    // MIGRATION: location, branches, departments
    // ---------------------------------------------------------
    const [locationTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'location'",
      [dbConfig.database],
    );

    if (locationTable[0].count === 0) {
      console.log("📋 Creating location table...");
      await connection.execute(`
        CREATE TABLE location (
          id INT AUTO_INCREMENT PRIMARY KEY,
          office_name VARCHAR(255) NOT NULL,
          office_address TEXT,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    const [branchesTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'branches'",
      [dbConfig.database],
    );

    if (branchesTable[0].count === 0) {
      console.log("📋 Creating branches table...");
      await connection.execute(`
        CREATE TABLE branches (
          id INT AUTO_INCREMENT PRIMARY KEY,
          branch_name VARCHAR(255) NOT NULL,
          branch_desc TEXT,
          branch_logo VARCHAR(255) NULL,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } else {
      // Migration: Add branch_logo if it doesn't exist
      try {
        const [branchColCheck] = await connection.execute(
          "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'branch_logo'",
          [dbConfig.database],
        );
        if (branchColCheck[0].count === 0) {
          console.log(
            "migrating: Adding branch_logo column to branches table...",
          );
          await connection.execute(
            "ALTER TABLE branches ADD COLUMN branch_logo VARCHAR(255) NULL AFTER branch_desc",
          );
          console.log("✅ branch_logo column added to branches.");
        }
      } catch (migErr) {
        console.error(
          "Migration warning (branches.branch_logo):",
          migErr.message,
        );
      }
    }

    const [departmentsTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'departments'",
      [dbConfig.database],
    );

    if (departmentsTable[0].count === 0) {
      console.log("📋 Creating departments table...");
      await connection.execute(`
        CREATE TABLE departments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          branch_id INT,
          dept_name VARCHAR(255) NOT NULL,
          dept_code VARCHAR(50),
          parent_id INT NULL,
          location INT NULL,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL,
          FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
          FOREIGN KEY (location) REFERENCES location(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    // ---------------------------------------------------------
    // MIGRATION: Ensure profile_picture column exists in users
    // ---------------------------------------------------------
    try {
      const [userColCheck] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'profile_picture'",
        [dbConfig.database],
      );
      if (userColCheck[0].count === 0) {
        console.log(
          "migrating: Adding profile_picture column to users table...",
        );
        await connection.execute(
          "ALTER TABLE users ADD COLUMN profile_picture VARCHAR(255) NULL AFTER email",
        );
        console.log("✅ profile_picture column added to users.");
      }
    } catch (migErr) {
      console.error(
        "Migration warning (users.profile_picture):",
        migErr.message,
      );
    }

    // Check and create work_calendar table
    const [workCalendarTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'work_calendar'",
      [dbConfig.database],
    );

    if (workCalendarTable[0].count === 0) {
      console.log("📋 Creating work_calendar table...");

      await connection.execute(`
        CREATE TABLE work_calendar (
          id INT AUTO_INCREMENT PRIMARY KEY,
          date DATE NOT NULL,
          type ENUM('company_anniversary', 'replacement_workday', 'replacement_holiday', 'sto_audit') NOT NULL,
          description TEXT,
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL,
          UNIQUE KEY unique_date (date),
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      console.log("✅ work_calendar table created");
    }

    // Check and create event_colors table for color settings
    const [eventColorsTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'event_colors'",
      [dbConfig.database],
    );

    if (eventColorsTable[0].count === 0) {
      console.log("📋 Creating event_colors table...");

      await connection.execute(`
        CREATE TABLE event_colors (
          id INT AUTO_INCREMENT PRIMARY KEY,
          event_type ENUM('company_anniversary', 'replacement_workday', 'replacement_holiday', 'sto_audit', 'national_holiday', 'cuti_bersama') NOT NULL UNIQUE,
          color VARCHAR(7) NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Insert default colors
      await connection.execute(`
        INSERT INTO event_colors (event_type, color) VALUES
        ('company_anniversary', '#8B5CF6'),
        ('replacement_workday', '#3B82F6'),
        ('replacement_holiday', '#F59E0B'),
        ('sto_audit', '#10B981'),
        ('national_holiday', '#EF4444'),
        ('cuti_bersama', '#F97316')
      `);

      console.log("✅ event_colors table created with default colors");
    }

    // Check and create national_holidays_cache table
    const [nationalHolidaysTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'national_holidays_cache'",
      [dbConfig.database],
    );

    if (nationalHolidaysTable[0].count === 0) {
      console.log("📋 Creating national_holidays_cache table...");

      await connection.execute(`
        CREATE TABLE national_holidays_cache (
          id INT AUTO_INCREMENT PRIMARY KEY,
          year INT NOT NULL,
          date DATE NOT NULL,
          name VARCHAR(255) NOT NULL,
          is_national_holiday BOOLEAN DEFAULT TRUE,
          is_cuti_bersama BOOLEAN DEFAULT FALSE,
          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_year_date (year, date),
          INDEX idx_year (year),
          INDEX idx_date (date)
        )
      `);

      console.log("✅ national_holidays_cache table created successfully");
    }

    // ---------------------------------------------------------
    // MIGRATION: positions, titles, employees
    // ---------------------------------------------------------
    const [positionsTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'positions'",
      [dbConfig.database],
    );

    if (positionsTable[0].count === 0) {
      console.log("📋 Creating positions table...");
      await connection.execute(`
        CREATE TABLE positions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          dept_id INT NULL,
          position_name VARCHAR(255) NOT NULL,
          parent_id INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL,
          FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    const [titlesTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'titles'",
      [dbConfig.database],
    );

    if (titlesTable[0].count === 0) {
      console.log("📋 Creating titles table...");
      await connection.execute(`
        CREATE TABLE titles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title_name VARCHAR(255) NOT NULL,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    const [employeesTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'employees'",
      [dbConfig.database],
    );

    if (employeesTable[0].count === 0) {
      console.log("📋 Creating employees table...");
      await connection.execute(`
        CREATE TABLE employees (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NULL,
          nik VARCHAR(50) UNIQUE NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          branch_id INT NULL,
          department_id INT NULL,
          position_id INT NULL,
          location_id INT NULL,
          title_id INT NULL,
          employee_status VARCHAR(50),
          employee_shift_id INT NULL,
          join_date DATE,
          effective_date DATE,
          effective_end_date DATE,
          religion VARCHAR(50),
          gender ENUM('Male', 'Female'),
          marital_status VARCHAR(50),
          place_of_birth VARCHAR(100),
          date_of_birth DATE,
          address TEXT,
          phone VARCHAR(20),
          office_email VARCHAR(100),
          personal_email VARCHAR(100),
          npwp VARCHAR(50),
          bpjs_tk VARCHAR(50),
          bpjs_health VARCHAR(50),
          ktp_number VARCHAR(50),
          rfid_number VARCHAR(50),
          picture VARCHAR(255),
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL,
          is_deleted TINYINT(1) DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
          FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
          FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL,
          FOREIGN KEY (location_id) REFERENCES location(id) ON DELETE SET NULL,
          FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    // Check and create news table
    const [newsTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'news'",
      [dbConfig.database],
    );

    if (newsTable[0].count === 0) {
      console.log("📋 Creating news table...");
      await connection.execute(`
        CREATE TABLE news (
          id CHAR(36) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          content LONGTEXT,
          category VARCHAR(100) NOT NULL,
          status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
          priority ENUM('normal', 'high', 'urgent') DEFAULT 'normal',
          created_by INT NULL,
          cover_image VARCHAR(255) NULL,
          publish_at DATETIME NULL,
          close_date DATETIME NULL,
          allow_comments BOOLEAN DEFAULT FALSE,
          pin_top BOOLEAN DEFAULT FALSE,
          view_count INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_status (status),
          INDEX idx_category (category),
          INDEX idx_created_at (created_at)
        )
      `);
      console.log("✅ news table created successfully");
    }

    // ---------------------------------------------------------
    // MIGRATION: Ensure cover_image column exists in news
    // ---------------------------------------------------------
    try {
      const [colCheck] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'news' AND COLUMN_NAME = 'cover_image'",
        [dbConfig.database],
      );
      if (colCheck[0].count === 0) {
        console.log("migrating: Adding cover_image column to news table...");
        await connection.execute(
          "ALTER TABLE news ADD COLUMN cover_image VARCHAR(255) NULL AFTER category",
        );
        console.log("✅ cover_image column added.");
      }
    } catch (migErr) {
      console.error("Migration warning:", migErr.message);
    }

    // Check and create news_files table
    const [newsFilesTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'news_files'",
      [dbConfig.database],
    );

    if (newsFilesTable[0].count === 0) {
      console.log("📋 Creating news_files table...");
      await connection.execute(`
        CREATE TABLE news_files (
          id INT AUTO_INCREMENT PRIMARY KEY,
          news_id CHAR(36) NOT NULL,
          file_path TEXT NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_type ENUM('image', 'attachment') DEFAULT 'attachment',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
          INDEX idx_news_id (news_id)
        )
      `);
      console.log("✅ news_files table created successfully");
    }

    // Check and create news_targets table
    const [newsTargetsTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'news_targets'",
      [dbConfig.database],
    );

    if (newsTargetsTable[0].count === 0) {
      console.log("📋 Creating news_targets table...");
      await connection.execute(`
        CREATE TABLE news_targets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          news_id CHAR(36) NOT NULL,
          target_type ENUM('all', 'department', 'role', 'user') NOT NULL,
          target_value VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
          INDEX idx_news_id (news_id)
        )
      `);
      console.log("✅ news_targets table created successfully");
    }

    // Check and create news_read table
    const [newsReadTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'news_read'",
      [dbConfig.database],
    );

    if (newsReadTable[0].count === 0) {
      console.log("📋 Creating news_read table...");
      await connection.execute(`
        CREATE TABLE news_read (
          id INT AUTO_INCREMENT PRIMARY KEY,
          news_id CHAR(36) NOT NULL,
          user_id INT NOT NULL,
          read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_read (news_id, user_id)
        )
      `);
      console.log("✅ news_read table created successfully");
    }

    // Check and create news_comments table
    const [newsCommentsTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'news_comments'",
      [dbConfig.database],
    );

    if (newsCommentsTable[0].count === 0) {
      console.log("📋 Creating news_comments table...");

      await connection.execute(`
          CREATE TABLE news_comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            news_id CHAR(36) NOT NULL,
            user_id INT NULL,
            comment TEXT NOT NULL,
            parent_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_news_id (news_id),
            INDEX idx_user_id (user_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

      console.log("✅ news_comments table created successfully");
    }

    // Check and create attendance_log table
    const [attendanceLogTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'attendance_log'",
      [dbConfig.database],
    );

    if (attendanceLogTable[0].count === 0) {
      console.log("📋 Creating attendance_log table...");
      await connection.execute(`
        CREATE TABLE attendance_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nik VARCHAR(50) NOT NULL,
          full_name VARCHAR(100),
          rfid_number VARCHAR(50),
          picture VARCHAR(255),
          attendance_date DATE,
          attendance_time TIME,
          is_matched VARCHAR(50) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_nik (nik),
          INDEX idx_date (attendance_date)
        )
      `);
      console.log("✅ attendance_log table created successfully");
    }

    // ---------------------------------------------------------
    // MIGRATION: Ensure is_matched column exists in attendance_log
    // ---------------------------------------------------------
    try {
      const [attColCheck] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_log' AND COLUMN_NAME = 'is_matched'",
        [dbConfig.database],
      );
      if (attColCheck[0].count === 0) {
        console.log(
          "migrating: Adding is_matched column to attendance_log table...",
        );
        await connection.execute(
          "ALTER TABLE attendance_log ADD COLUMN is_matched VARCHAR(50) DEFAULT NULL AFTER attendance_time",
        );
        console.log("✅ is_matched column added to attendance_log.");
      }
    } catch (migErr) {
      console.error(
        "Migration warning (attendance_log.is_matched):",
        migErr.message,
      );
    }

    // ---------------------------------------------------------
    // MIGRATION: Ensure columns in calendar_event_types
    // ---------------------------------------------------------
    try {
      // is_deleted
      const [colCheck1] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'calendar_event_types' AND COLUMN_NAME = 'is_deleted'",
        [dbConfig.database],
      );
      if (colCheck1[0].count === 0) {
        console.log(
          "migrating: Adding is_deleted column to calendar_event_types...",
        );
        await connection.execute(
          "ALTER TABLE calendar_event_types ADD COLUMN is_deleted TINYINT(1) DEFAULT 0 AFTER is_active",
        );
      }

      // deleted_at
      const [colCheck2] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'calendar_event_types' AND COLUMN_NAME = 'deleted_at'",
        [dbConfig.database],
      );
      if (colCheck2[0].count === 0) {
        console.log(
          "migrating: Adding deleted_at column to calendar_event_types...",
        );
        await connection.execute(
          "ALTER TABLE calendar_event_types ADD COLUMN deleted_at DATETIME NULL AFTER is_deleted",
        );
      }

      // is_used
      const [colCheck3] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'calendar_event_types' AND COLUMN_NAME = 'is_used'",
        [dbConfig.database],
      );
      if (colCheck3[0].count === 0) {
        console.log(
          "migrating: Adding is_used column to calendar_event_types...",
        );
        await connection.execute(
          "ALTER TABLE calendar_event_types ADD COLUMN is_used TINYINT(1) DEFAULT 0 AFTER deleted_at",
        );
      }
    } catch (migErr) {
      console.error(
        "Migration warning (calendar_event_types):",
        migErr.message,
      );
    }

    // ---------------------------------------------------------
    // MIGRATION: Add auto_target columns to work_calendar
    // ---------------------------------------------------------
    try {
      // auto_target_type
      const [colCheckWC1] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'work_calendar' AND COLUMN_NAME = 'auto_target_type'",
        [dbConfig.database],
      );
      if (colCheckWC1[0].count === 0) {
        console.log(
          "migrating: Adding auto_target_type column to work_calendar...",
        );
        await connection.execute(
          "ALTER TABLE work_calendar ADD COLUMN auto_target_type VARCHAR(50) NULL AFTER target_value",
        );
      }

      // auto_target_value
      const [colCheckWC2] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'work_calendar' AND COLUMN_NAME = 'auto_target_value'",
        [dbConfig.database],
      );
      if (colCheckWC2[0].count === 0) {
        console.log(
          "migrating: Adding auto_target_value column to work_calendar...",
        );
        await connection.execute(
          "ALTER TABLE work_calendar ADD COLUMN auto_target_value TEXT NULL AFTER auto_target_type",
        );
      }
    } catch (migErr) {
      console.error("Migration warning (work_calendar):", migErr.message);
    }

    // ---------------------------------------------------------
    // MIGRATION: Change ENUM to VARCHAR for dynamic event types
    // ---------------------------------------------------------
    try {
      // work_calendar.type
      console.log(
        "migrating: Changing work_calendar.type from ENUM to VARCHAR...",
      );
      await connection.execute(
        "ALTER TABLE work_calendar MODIFY COLUMN type VARCHAR(100) NOT NULL",
      );
    } catch (migErr) {
      console.error("Migration warning (work_calendar type):", migErr.message);
    }

    // ---------------------------------------------------------
    // MIGRATION: Change Employee FK columns to VARCHAR (for multi-select)
    // ---------------------------------------------------------
    try {
      console.log(
        "migrating: Updating employees table for multi-select support...",
      );

      // function to safely drop FK
      const dropFkIfExists = async (tableName, constraintName) => {
        try {
          // Check if constraint exists
          const [rows] = await connection.execute(
            `SELECT CONSTRAINT_NAME 
             FROM information_schema.KEY_COLUMN_USAGE 
             WHERE TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND TABLE_SCHEMA = ?`,
            [tableName, constraintName, dbConfig.database],
          );
          if (rows.length > 0) {
            await connection.execute(
              `ALTER TABLE ${tableName} DROP FOREIGN KEY ${constraintName}`,
            );
            console.log(`Dropped FK: ${constraintName}`);
          }
        } catch (e) {
          console.log(`Error dropping FK ${constraintName}: ${e.message}`);
        }
      };

      // These depend on the constraint names generated by MySQL.
      // Usually employees_ibfk_X but might differ.
      // Safest way is to query constraint name by column, but here we try standard names or just Modify Column which might fail if FK exists.
      // Actually, MODIFY COLUMN to VARCHAR usually Works even with FK if data is compatible, but "3,10" is NOT compatible with INT ref.
      // So we MUST drop FKs.

      // Let's Find FK names dynamically
      const dropFkByColumn = async (colName) => {
        try {
          const [rows] = await connection.execute(
            `SELECT CONSTRAINT_NAME 
             FROM information_schema.KEY_COLUMN_USAGE 
             WHERE TABLE_NAME = 'employees' AND COLUMN_NAME = ? AND TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
            [colName, dbConfig.database],
          );
          for (const row of rows) {
            await connection.execute(
              `ALTER TABLE employees DROP FOREIGN KEY ${row.CONSTRAINT_NAME}`,
            );
            console.log(`Dropped FK for ${colName}: ${row.CONSTRAINT_NAME}`);
          }
        } catch (e) {
          console.log(`Error checking FK for ${colName}: ${e.message}`);
        }
      };

      await dropFkByColumn("department_id");
      await dropFkByColumn("position_id");
      await dropFkByColumn("title_id");
      await dropFkByColumn("location_id");

      // Now Modify Columns
      await connection.execute(
        "ALTER TABLE employees MODIFY COLUMN department_id VARCHAR(255) NULL",
      );
      await connection.execute(
        "ALTER TABLE employees MODIFY COLUMN position_id VARCHAR(255) NULL",
      );
      await connection.execute(
        "ALTER TABLE employees MODIFY COLUMN title_id VARCHAR(255) NULL",
      );
      // location_id might not exist yet if migration order, but previous steps add it.
      // We will try modifying it.
      await connection.execute(
        "ALTER TABLE employees MODIFY COLUMN location_id VARCHAR(255) NULL",
      );

      console.log("✅ Employees table updated to VARCHAR for multi-select IDs");
    } catch (migErr) {
      // console.error("Migration warning (work_calendar/employees):", migErr.message);
      // Suppress logging repetitive errors if already applied
    }

    // event_colors.event_type
    try {
      console.log(
        "migrating: Changing event_colors.event_type from ENUM to VARCHAR...",
      );
      await connection.execute(
        "ALTER TABLE event_colors MODIFY COLUMN event_type VARCHAR(100) NOT NULL",
      );
      console.log("✅ ENUM columns successfully changed to VARCHAR.");
    } catch (migErr) {
      console.error("Migration warning (ENUM to VARCHAR):", migErr.message);
    }

    // ---------------------------------------------------------
    // MIGRATION: attendance tables
    // ---------------------------------------------------------
    const [attendanceShiftsTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'attendance_shifts'",
      [dbConfig.database],
    );

    if (attendanceShiftsTable[0].count === 0) {
      console.log("📋 Creating attendance_shifts table...");
      await connection.execute(`
        CREATE TABLE attendance_shifts (
          shift_id INT AUTO_INCREMENT PRIMARY KEY,
          shift_code VARCHAR(50) NULL,
          shift_name VARCHAR(100) NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          break_start TIME NULL,
          break_end TIME NULL,
          work_days JSON NULL,
          breaks JSON NULL,
          is_active TINYINT(1) DEFAULT 1,
          is_deleted TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    const [attendanceShiftRulesTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'attendance_shift_rules'",
      [dbConfig.database],
    );

    if (attendanceShiftRulesTable[0].count === 0) {
      console.log("📋 Creating attendance_shift_rules table...");
      await connection.execute(`
        CREATE TABLE attendance_shift_rules (
          id INT AUTO_INCREMENT PRIMARY KEY,
          shift_id INT NOT NULL,
          rule_name VARCHAR(100) NOT NULL,
          rule_value VARCHAR(255) NOT NULL,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL,
          FOREIGN KEY (shift_id) REFERENCES attendance_shifts(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    const [attendanceEmployeeShiftTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'attendance_employee_shift'",
      [dbConfig.database],
    );

    if (attendanceEmployeeShiftTable[0].count === 0) {
      console.log("📋 Creating attendance_employee_shift table...");
      await connection.execute(`
        CREATE TABLE attendance_employee_shift (
          id INT AUTO_INCREMENT PRIMARY KEY,
          employee_id INT NULL,
          nik VARCHAR(50) NULL,
          target_type VARCHAR(50) DEFAULT 'user',
          target_value TEXT NULL,
          rule_type VARCHAR(20) DEFAULT 'shift',
          shift_id VARCHAR(255) NULL,
          start_date DATE,
          end_date DATE,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL,
          FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    const [attendanceCodeTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'attendance_code'",
      [dbConfig.database],
    );

    if (attendanceCodeTable[0].count === 0) {
      console.log("📋 Creating attendance_code table...");
      await connection.execute(`
        CREATE TABLE attendance_code (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code VARCHAR(20) UNIQUE NOT NULL,
          description VARCHAR(255),
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    const [attendanceSettingsTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'attendance_settings'",
      [dbConfig.database],
    );

    if (attendanceSettingsTable[0].count === 0) {
      console.log("📋 Creating attendance_settings table...");
      await connection.execute(`
        CREATE TABLE attendance_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          setting_key VARCHAR(100) UNIQUE NOT NULL,
          setting_value TEXT,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    // ---------------------------------------------------------
    // MIGRATION: dashboard and apps
    // ---------------------------------------------------------
    const [dashboardCardsTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'dashboard_cards'",
      [dbConfig.database],
    );

    if (dashboardCardsTable[0].count === 0) {
      console.log("📋 Creating dashboard_cards table...");
      await connection.execute(`
        CREATE TABLE dashboard_cards (
          id INT AUTO_INCREMENT PRIMARY KEY,
          card_name VARCHAR(100) NOT NULL,
          card_type VARCHAR(50) NOT NULL,
          component_name VARCHAR(100),
          default_x INT DEFAULT 0,
          default_y INT DEFAULT 0,
          default_w INT DEFAULT 12,
          default_h INT DEFAULT 4,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    const [userDashboardPreferencesTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'user_dashboard_preferences'",
      [dbConfig.database],
    );

    if (userDashboardPreferencesTable[0].count === 0) {
      console.log("📋 Creating user_dashboard_preferences table...");
      await connection.execute(`
        CREATE TABLE user_dashboard_preferences (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          card_id INT NOT NULL,
          is_visible TINYINT(1) NOT NULL DEFAULT 1,
          display_order INT NOT NULL DEFAULT 0,
          x INT DEFAULT 0,
          y INT DEFAULT 0,
          w INT DEFAULT 12,
          h INT DEFAULT 4,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_card (user_id, card_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (card_id) REFERENCES dashboard_cards(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    const [userFavoriteAppsTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'user_favorite_apps'",
      [dbConfig.database],
    );

    if (userFavoriteAppsTable[0].count === 0) {
      console.log("📋 Creating user_favorite_apps table...");
      await connection.execute(`
        CREATE TABLE user_favorite_apps (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          portal_app_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_app (user_id, portal_app_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (portal_app_id) REFERENCES portal_settings(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    // ---------------------------------------------------------
    // MIGRATION: Notifications and User Item Views
    // ---------------------------------------------------------
    try {
      // notifications
      const [tableNotify] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'notifications'",
        [dbConfig.database],
      );
      if (tableNotify[0].count === 0) {
        console.log("creating: notifications table...");
        await connection.execute(`
          CREATE TABLE notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            link VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }

      // Column additions for existing notifications table
      try {
        const [cols] = await connection.execute(
          "SHOW COLUMNS FROM notifications LIKE 'item_type'",
        );
        if (cols.length === 0) {
          console.log(
            "migrating: adding item_type and item_id to notifications...",
          );
          await connection.execute(
            "ALTER TABLE notifications ADD COLUMN item_type VARCHAR(50) NULL, ADD COLUMN item_id VARCHAR(100) NULL",
          );
        }
      } catch (colErr) {
        console.error(
          "Migration error (notifications columns):",
          colErr.message,
        );
      }

      // notification_reads
      const [tableNotifyRead] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'notification_reads'",
        [dbConfig.database],
      );
      if (tableNotifyRead[0].count === 0) {
        console.log("creating: notification_reads table...");
        await connection.execute(`
          CREATE TABLE notification_reads (
            id INT AUTO_INCREMENT PRIMARY KEY,
            notification_id INT NOT NULL,
            user_id INT NOT NULL,
            read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_hidden TINYINT(1) DEFAULT 0,
            UNIQUE KEY unq_notif_user (notification_id, user_id)
          )
        `);
      }

      // migration: add is_hidden if table exists but column doesn't
      try {
        const [colCheck] = await connection.execute(
          "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'notification_reads' AND COLUMN_NAME = 'is_hidden'",
          [dbConfig.database],
        );
        if (colCheck[0].count === 0) {
          console.log(
            "migrating: Adding is_hidden column to notification_reads table...",
          );
          await connection.execute(
            "ALTER TABLE notification_reads ADD COLUMN is_hidden TINYINT(1) DEFAULT 0",
          );
          console.log("✅ is_hidden column added to notification_reads.");
        }
      } catch (migErr) {
        console.error(
          "Migration warning (notification_reads):",
          migErr.message,
        );
      }

      // user_item_views
      const [tableItemView] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'user_item_views'",
        [dbConfig.database],
      );
      if (tableItemView[0].count === 0) {
        console.log("creating: user_item_views table...");
        await connection.execute(`
          CREATE TABLE user_item_views (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            item_type VARCHAR(50) NOT NULL, 
            item_id VARCHAR(100) NOT NULL,
            viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unq_user_item (user_id, item_type, item_id)
          )
        `);
      }

      // Add used_by columns to calendar_event_types
      try {
        const [usedByCols] = await connection.execute(
          "SHOW COLUMNS FROM calendar_event_types LIKE 'used_by_type'",
        );
        if (usedByCols.length === 0) {
          console.log(
            "migrating: adding used_by_type and used_by_value to calendar_event_types...",
          );
          await connection.execute(
            "ALTER TABLE calendar_event_types ADD COLUMN used_by_type VARCHAR(50) NULL, ADD COLUMN used_by_value TEXT NULL",
          );
        }
      } catch (usedByErr) {
        console.error(
          "Migration error (calendar_event_types used_by columns):",
          usedByErr.message,
        );
      }

      // portal_settings
      const [tablePortal] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'portal_settings'",
        [dbConfig.database],
      );
      if (tablePortal[0].count === 0) {
        console.log("creating: portal_settings table...");
        await connection.execute(`
          CREATE TABLE portal_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            portal_name VARCHAR(100) NOT NULL,
            description TEXT,
            category VARCHAR(50),
            url VARCHAR(255),
            portal_image VARCHAR(255),
            is_active TINYINT(1) DEFAULT 1,
            used_by_type VARCHAR(50),
            used_by_value TEXT,
            is_deleted TINYINT(1) DEFAULT 0,
            deleted_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
        console.log("✅ portal_settings table created successfully");
      }

      // Check and create banners table
      const [tableBanners] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'banners'",
        [dbConfig.database],
      );
      if (tableBanners[0].count === 0) {
        console.log("creating: banners table...");
        await connection.execute(`
          CREATE TABLE banners (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            banner_image VARCHAR(255),
            link_url VARCHAR(255),
            is_active TINYINT(1) DEFAULT 1,
            priority INT DEFAULT 0,
            is_deleted TINYINT(1) DEFAULT 0,
            deleted_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_by INT NULL,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
          )
        `);
        console.log("✅ banners table created successfully");
      }
    } catch (migErr) {
      console.error("Migration error (Notifications/Views):", migErr.message);
    }

    // 🚀 Migration for Employee Setup: add location_id and employee_shift_id
    try {
      const [cols] = await connection.execute("SHOW COLUMNS FROM employees");
      const columnNames = cols.map((c) => c.Field);

      if (!columnNames.includes("location_id")) {
        console.log("Adding location_id to employees table...");
        await connection.execute(
          "ALTER TABLE employees ADD COLUMN location_id INT NULL AFTER position_id",
        );
      }
      if (!columnNames.includes("employee_shift_id")) {
        console.log("Adding employee_shift_id to employees table...");
        await connection.execute(
          "ALTER TABLE employees ADD COLUMN employee_shift_id VARCHAR(255) NULL AFTER location_id",
        );
      }
    } catch (migErr) {
      console.warn(
        "Migration warning (employees setup columns):",
        migErr.message,
      );
    }

    // 🚀 Migration for Attendance Employee Shift: add target_type, target_value, and rule_type
    try {
      const [cols] = await connection.execute(
        "SHOW COLUMNS FROM attendance_employee_shift",
      );
      const columnNames = cols.map((c) => c.Field);

      if (!columnNames.includes("target_type")) {
        // Check if employee_id column needs to be made nullable
        const [employeeIdCol] = await connection.execute(
          "SELECT COLUMN_NAME, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_employee_shift' AND COLUMN_NAME = 'employee_id'",
          [dbConfig.database],
        );

        if (employeeIdCol.length > 0 && employeeIdCol[0].IS_NULLABLE === "NO") {
          console.log("🔧 Making employee_id column nullable...");
          await connection.execute(
            "ALTER TABLE attendance_employee_shift MODIFY COLUMN employee_id INT NULL DEFAULT NULL",
          );
          console.log("✅ employee_id is now nullable");
        }
        await connection.execute(
          "ALTER TABLE attendance_employee_shift ADD COLUMN target_type VARCHAR(50) DEFAULT 'user' AFTER employee_id",
        );
      }
      if (!columnNames.includes("target_value")) {
        console.log("Adding target_value to attendance_employee_shift...");
        await connection.execute(
          "ALTER TABLE attendance_employee_shift ADD COLUMN target_value TEXT NULL AFTER target_type",
        );
        // Initialize target_value with employee_id for existing rows
        await connection.execute(
          "UPDATE attendance_employee_shift SET target_value = employee_id WHERE target_value IS NULL",
        );
      }
      if (!columnNames.includes("rule_type")) {
        console.log("Adding rule_type to attendance_employee_shift...");
        await connection.execute(
          "ALTER TABLE attendance_employee_shift ADD COLUMN rule_type VARCHAR(20) DEFAULT 'shift' AFTER target_value",
        );
      }
    } catch (migErr) {
      console.warn(
        "Migration warning (attendance_employee_shift columns):",
        migErr.message,
      );
    }

    // 🚀 Migration for Employee Shift Assignment: multiple shifts and NIK
    try {
      const [cols] = await connection.execute(
        "SHOW COLUMNS FROM attendance_employee_shift",
      );
      const columnNames = cols.map((c) => c.Field);

      // Add nik column
      if (!columnNames.includes("nik")) {
        console.log("🔧 Adding nik column to attendance_employee_shift...");
        await connection.execute(
          "ALTER TABLE attendance_employee_shift ADD COLUMN nik VARCHAR(50) NULL AFTER employee_id",
        );
      }

      // Change shift_id to VARCHAR(255) if it's currently INT
      const shiftIdCol = cols.find((c) => c.Field === "shift_id");
      if (shiftIdCol && shiftIdCol.Type.toLowerCase().includes("int")) {
        console.log(
          "🔧 Changing attendance_employee_shift.shift_id to VARCHAR(255)...",
        );
        // Remove FK if exists first
        try {
          const [fkRows] = await connection.execute(
            `
            SELECT CONSTRAINT_NAME 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_employee_shift' AND COLUMN_NAME = 'shift_id'
          `,
            [dbConfig.database],
          );
          for (const fk of fkRows) {
            await connection.execute(
              `ALTER TABLE attendance_employee_shift DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`,
            );
          }
        } catch (fkErr) {
          console.warn(
            "Could not drop shift_id FK (might not exist):",
            fkErr.message,
          );
        }
        await connection.execute(
          "ALTER TABLE attendance_employee_shift MODIFY COLUMN shift_id VARCHAR(255) NULL",
        );
      }
    } catch (migErr) {
      console.warn(
        "Migration warning (attendance_employee_shift multiple shifts):",
        migErr.message,
      );
    }

    // 🚀 Migration for Employees table: multiple shift cache type fix (if it was created as INT)
    try {
      const [cols] = await connection.execute("SHOW COLUMNS FROM employees");
      const employeeShiftIdCol = cols.find(
        (c) => c.Field === "employee_shift_id",
      );
      if (
        employeeShiftIdCol &&
        employeeShiftIdCol.Type.toLowerCase().includes("int")
      ) {
        console.log(
          "🔧 Changing employees.employee_shift_id to VARCHAR(255)...",
        );
        await connection.execute(
          "ALTER TABLE employees MODIFY COLUMN employee_shift_id VARCHAR(255) NULL",
        );
      }
    } catch (migErr) {
      console.warn(
        "Migration warning (employees.employee_shift_id type fix):",
        migErr.message,
      );
    }

    // 🚀 Migration for Attendance Shifts: add missing columns, rename PK, and remove unique shift_code
    try {
      const [cols] = await connection.execute(
        "SHOW COLUMNS FROM attendance_shifts",
      );
      const columnNames = cols.map((c) => c.Field);

      // Rename id to shift_id if needed
      if (columnNames.includes("id") && !columnNames.includes("shift_id")) {
        console.log("🔧 Renaming id to shift_id in attendance_shifts...");
        await connection.execute(
          "ALTER TABLE attendance_shifts CHANGE COLUMN id shift_id INT AUTO_INCREMENT",
        );
      }

      // Add missing columns
      if (!columnNames.includes("shift_code")) {
        await connection.execute(
          "ALTER TABLE attendance_shifts ADD COLUMN shift_code VARCHAR(50) NULL AFTER shift_id",
        );
      }
      if (!columnNames.includes("break_start")) {
        await connection.execute(
          "ALTER TABLE attendance_shifts ADD COLUMN break_start TIME NULL AFTER end_time",
        );
      }
      if (!columnNames.includes("break_end")) {
        await connection.execute(
          "ALTER TABLE attendance_shifts ADD COLUMN break_end TIME NULL AFTER break_start",
        );
      }
      if (!columnNames.includes("work_days")) {
        await connection.execute(
          "ALTER TABLE attendance_shifts ADD COLUMN work_days JSON NULL AFTER break_end",
        );
      }
      if (!columnNames.includes("breaks")) {
        await connection.execute(
          "ALTER TABLE attendance_shifts ADD COLUMN breaks JSON NULL AFTER work_days",
        );
      }
      if (!columnNames.includes("is_deleted")) {
        await connection.execute(
          "ALTER TABLE attendance_shifts ADD COLUMN is_deleted TINYINT(1) DEFAULT 0 AFTER is_active",
        );
      }

      // 🔍 Remove UNIQUE constraint on shift_code
      try {
        // Find if there's a unique index on shift_code
        const [indexes] = await connection.execute(
          "SHOW INDEX FROM attendance_shifts WHERE Column_name = 'shift_code' AND Non_unique = 0",
        );
        for (const idx of indexes) {
          console.log(
            `🔧 Dropping UNIQUE index: ${idx.Key_name} on attendance_shifts...`,
          );
          await connection.execute(
            `ALTER TABLE attendance_shifts DROP INDEX ${idx.Key_name}`,
          );
        }
      } catch (idxErr) {
        console.warn(
          "Migration warning (dropping shift_code index):",
          idxErr.message,
        );
      }
    } catch (migErr) {
      console.warn(
        "Migration warning (attendance_shifts columns):",
        migErr.message,
      );
    }
    // 🚀 Migration for Trucks: add missing columns if they don't exist
    try {
      const [cols] = await connection.execute("SHOW COLUMNS FROM trucks");
      const columnNames = cols.map((c) => c.Field);

      if (!columnNames.includes("priority")) {
        await connection.execute(
          "ALTER TABLE trucks ADD COLUMN priority ENUM('normal', 'high', 'urgent', 'low') DEFAULT 'normal' AFTER status",
        );
      }
      if (!columnNames.includes("dock_number")) {
        await connection.execute(
          "ALTER TABLE trucks ADD COLUMN dock_number VARCHAR(50) NULL AFTER check_in_time",
        );
      }
      if (!columnNames.includes("cargo_type")) {
        await connection.execute(
          "ALTER TABLE trucks ADD COLUMN cargo_type VARCHAR(100) NULL AFTER dock_number",
        );
      }
      if (!columnNames.includes("cargo_weight")) {
        await connection.execute(
          "ALTER TABLE trucks ADD COLUMN cargo_weight VARCHAR(50) NULL AFTER cargo_type",
        );
      }
      if (!columnNames.includes("special_instructions")) {
        await connection.execute(
          "ALTER TABLE trucks ADD COLUMN special_instructions TEXT NULL AFTER notes",
        );
      }
      if (!columnNames.includes("created_by")) {
        await connection.execute(
          "ALTER TABLE trucks ADD COLUMN created_by INT NULL AFTER special_instructions",
        );
        // Add foreign key for created_by
        await connection.execute(
          "ALTER TABLE trucks ADD CONSTRAINT fk_trucks_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL",
        );
      }
    } catch (migErr) {
      console.warn("Migration warning (trucks columns):", migErr.message);
    }

    // ---------------------------------------------------------
    // MIGRATION: Views
    // ---------------------------------------------------------
    console.log("📋 Updating views...");
    try {
      await connection.execute(`
        CREATE OR REPLACE VIEW active_trucks AS 
        SELECT 
          t.id, t.license_plate, t.driver_name, t.destination, t.status, t.priority, 
          t.scheduled_time, t.check_in_time, t.dock_number, t.cargo_type, t.cargo_weight,
          CASE 
            WHEN t.status IN ('checked_in', 'loading', 'loaded') THEN TIMESTAMPDIFF(MINUTE, t.check_in_time, NOW())
            WHEN t.status = 'checked_out' THEN t.duration_minutes 
            ELSE NULL 
          END AS current_duration,
          t.notes, t.special_instructions, u.full_name AS created_by_name
        FROM trucks t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.status IN ('scheduled', 'checked_in', 'loading', 'loaded')
        ORDER BY 
          CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END,
          t.scheduled_time;
      `);

      await connection.execute(`
        CREATE OR REPLACE VIEW dashboard_summary AS 
        SELECT 
          COUNT(*) AS total_trucks,
          SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled_count,
          SUM(CASE WHEN status = 'checked_in' THEN 1 ELSE 0 END) AS checked_in_count,
          SUM(CASE WHEN status = 'loading' THEN 1 ELSE 0 END) AS loading_count,
          SUM(CASE WHEN status = 'loaded' THEN 1 ELSE 0 END) AS loaded_count,
          SUM(CASE WHEN status = 'checked_out' THEN 1 ELSE 0 END) AS checked_out_count,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
          ROUND(AVG(duration_minutes), 2) AS avg_duration_minutes,
          SUM(CASE WHEN DATE(scheduled_time) = CURDATE() THEN 1 ELSE 0 END) AS today_trucks
        FROM trucks;
      `);

      await connection.execute(`
        CREATE OR REPLACE VIEW departments_view AS 
        SELECT 
          d.id AS department_id, d.branch_id, d.dept_name, d.dept_code, d.parent_id, d.location,
          b.branch_name, b.branch_desc, p.dept_name AS parent_name, 
          l.office_name, l.office_address
        FROM departments d
        LEFT JOIN branches b ON d.branch_id = b.id
        LEFT JOIN departments p ON d.parent_id = p.id
        LEFT JOIN location l ON d.location = l.id
        WHERE d.deleted_at IS NULL;
      `);

      await connection.execute(`
        CREATE OR REPLACE VIEW testing_view AS 
        SELECT 
          e.*, d.dept_name AS department_name, p.position_name, t.title_name, b.branch_name
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN positions p ON e.position_id = p.id
        LEFT JOIN titles t ON e.title_id = t.id
        LEFT JOIN branches b ON e.branch_id = b.id
        WHERE e.deleted_at IS NULL
        ORDER BY e.full_name;
      `);
      console.log("✅ Views updated successfully");
    } catch (viewErr) {
      console.error("Error updating views:", viewErr.message);
    }

    // ---------------------------------------------------------
    // SEEDING: dashboard_cards
    // ---------------------------------------------------------
    const [cardCount] = await connection.execute(
      "SELECT COUNT(*) as count FROM dashboard_cards",
    );
    if (cardCount[0].count === 0) {
      console.log("🌱 Seeding dashboard_cards...");
      const defaultCards = [
        [
          "Attendance Overview",
          "attendance",
          "AttendanceOverviewCard",
          0,
          0,
          6,
          4,
        ],
        ["Who's Online", "status", "WhosOnlineCard", 6, 0, 6, 4],
        ["Recent Announcements", "news", "RecentNewsCard", 0, 4, 12, 4],
        ["Quick Actions", "actions", "QuickActionsCard", 0, 8, 4, 4],
        ["Calendar Events", "calendar", "CalendarCard", 4, 8, 8, 4],
      ];
      await connection.query(
        "INSERT INTO dashboard_cards (card_name, card_type, component_name, default_x, default_y, default_w, default_h) VALUES ?",
        [defaultCards],
      );
    }

    // ---------------------------------------------------------
    // SEEDING: attendance_settings
    // ---------------------------------------------------------
    const [settingCount] = await connection.execute(
      "SELECT COUNT(*) as count FROM attendance_settings",
    );
    if (settingCount[0].count === 0) {
      console.log("🌱 Seeding attendance_settings...");
      const defaultSettings = [
        ["late_threshold", "15", "Threshold in minutes to be considered late"],
        [
          "half_day_threshold",
          "240",
          "Threshold in minutes for half day attendance",
        ],
        ["early_leave_buffer", "5", "Buffer in minutes for early leave"],
      ];
      await connection.query(
        "INSERT INTO attendance_settings (setting_key, setting_value, description) VALUES ?",
        [defaultSettings],
      );
    }

    // ---------------------------------------------------------
    // SEEDING: portal_settings
    // ---------------------------------------------------------
    const [portalCount] = await connection.execute(
      "SELECT COUNT(*) as count FROM portal_settings",
    );
    if (portalCount[0].count === 0) {
      console.log("🌱 Seeding portal_settings...");
      const defaultPortals = [
        [
          "INFOR LN",
          "Enterprise Resource Planning System",
          "ERP",
          "http://10.4.1.16:8312/webui/servlet/standalone",
          "/uploads/portal/default-erp.png",
        ],
        [
          "ANDAL ESS",
          "Employee Self Service Portal",
          "HR",
          "http://10.4.1.8/",
          "/uploads/portal/default-hr.png",
        ],
        [
          "Helpdesk MIS",
          "MIS Support Ticketing System",
          "Support",
          "http://10.4.1.116/ticket_mis",
          "/uploads/portal/default-support.png",
        ],
      ];
      await connection.query(
        "INSERT INTO portal_settings (portal_name, description, category, url, portal_image) VALUES ?",
        [defaultPortals],
      );
    }

    // ---------------------------------------------------------
    // MIGRATION: attendance_summary table
    // ---------------------------------------------------------
    const [attendanceSummaryTable] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'attendance_summary'",
      [dbConfig.database],
    );

    if (attendanceSummaryTable[0].count === 0) {
      console.log("📋 Creating attendance_summary table...");
      await connection.execute(`
        CREATE TABLE attendance_summary (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nik VARCHAR(50) NOT NULL,
          attendance_date DATE NOT NULL,
          clock_in TIME,
          clock_out TIME,
          status VARCHAR(100),
          face_log_count INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_nik_date (nik, attendance_date),
          INDEX idx_nik (nik),
          INDEX idx_date (attendance_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log("✅ attendance_summary table created successfully");
    } else {
      // MIGRATION: Ensure shift_name column exists
      try {
        const [shiftColCheck] = await connection.execute(
          "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_summary' AND COLUMN_NAME = 'shift_name'",
          [dbConfig.database],
        );
        if (shiftColCheck[0].count === 0) {
          console.log(
            "migrating: Adding shift_name column to attendance_summary table...",
          );
          await connection.execute(
            "ALTER TABLE attendance_summary ADD COLUMN shift_name VARCHAR(100) NULL AFTER nik",
          );
          console.log("✅ shift_name column added to attendance_summary.");
        }

        const [codeColCheck] = await connection.execute(
          "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_summary' AND COLUMN_NAME = 'shift_code'",
          [dbConfig.database],
        );
        if (codeColCheck[0].count === 0) {
          console.log(
            "migrating: Adding shift_code column to attendance_summary table...",
          );
          await connection.execute(
            "ALTER TABLE attendance_summary ADD COLUMN shift_code VARCHAR(50) NULL AFTER nik",
          );
          console.log("✅ shift_code column added to attendance_summary.");
        }

        const [startColCheck] = await connection.execute(
          "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_summary' AND COLUMN_NAME = 'shift_start_time'",
          [dbConfig.database],
        );
        if (startColCheck[0].count === 0) {
          console.log(
            "migrating: Adding shift_start_time to attendance_summary...",
          );
          await connection.execute(
            "ALTER TABLE attendance_summary ADD COLUMN shift_start_time TIME NULL AFTER shift_name",
          );
        }

        const [endColCheck] = await connection.execute(
          "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_summary' AND COLUMN_NAME = 'shift_end_time'",
          [dbConfig.database],
        );
        if (endColCheck[0].count === 0) {
          console.log(
            "migrating: Adding shift_end_time to attendance_summary...",
          );
          await connection.execute(
            "ALTER TABLE attendance_summary ADD COLUMN shift_end_time TIME NULL AFTER shift_start_time",
          );
        }
      } catch (err) {
        console.warn(
          "Migration warning (attendance_summary columns):",
          err.message,
        );
      }

      // MIGRATION: Ensure correct collation for existing table
      // This fixes the "Illegal mix of collations" error
      try {
        await connection.execute(`
          ALTER TABLE attendance_summary 
          CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `);
      } catch (err) {
        console.warn(
          "⚠️ Migration warning (attendance_summary collation):",
          err.message,
        );
      }
    }
  } catch (error) {
    console.error("❌ Error creating tables:", error);
    // Don't throw error to allow server to start even if table creation fails
    // throw error;
  } finally {
    if (connection) connection.release();
  }
};

export const getPool = () => {
  if (!pool)
    throw new Error(
      "Database pool not initialized — call initDatabase() first",
    );
  return pool;
};

export const dbHelpers = {
  getPool() {
    return getPool();
  },

  async query(sql, params = []) {
    const p = getPool();

    console.log("=== DB QUERY ===");
    console.log("SQL:", sql);
    console.log("PARAMS RAW:", params);
    console.log("PARAMS COUNT:", params.length);
    console.log("TYPE:", Array.isArray(params) ? "ARRAY" : typeof params);

    // Enhanced parameter validation
    if (!Array.isArray(params)) {
      console.warn("⚠️  Parameters should be an array, converting...");
      params = [params];
    }

    // Log parameter details
    params.forEach((p, i) => {
      console.log(` - param[${i}] =>`, p, " (type:", typeof p, ")");
    });

    try {
      const [rows] = await p.execute(sql, params);
      console.log("✅ Query successful. Rows returned:", rows.length);
      return rows;
    } catch (error) {
      console.error("❌ DB Query Error:", {
        message: error.message,
        code: error.code,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        sql: sql,
        params: params,
      });
      throw error;
    }
  },

  async queryOne(sql, params = []) {
    const p = getPool();

    // Parameter validation
    if (!Array.isArray(params)) {
      params = [params];
    }

    const [rows] = await p.execute(sql, params);
    return rows[0] || null;
  },

  async execute(sql, params = []) {
    const p = getPool();

    // Parameter validation
    if (!Array.isArray(params)) {
      params = [params];
    }

    const [result] = await p.execute(sql, params);
    return result;
  },

  async beginTransaction() {
    const p = getPool();
    const conn = await p.getConnection();
    await conn.beginTransaction();
    return conn;
  },

  async commitTransaction(conn) {
    try {
      await conn.commit();
    } finally {
      conn.release();
    }
  },

  async rollbackTransaction(conn) {
    try {
      await conn.rollback();
    } finally {
      conn.release();
    }
  },
};

/**
 * 📂 Helper — Create Folder Structure for Truck Uploads
 * createUploadFolder(licensePlate, scheduledTime, truckAsal)
 * returns object {
 *   dateFolder, sanitizedLicensePlate, basePath, licensePlatePath, truckPhotosPath, documentPhotosPath, otherPhotosPath, relativePaths
 * }
 */
/**
 * 📂 Helper — Create Folder Structure for Truck Uploads
 * createUploadFolder(licensePlate, scheduledTime, truckAsal, truckId, stage)
 * stage: null | 'CHECK_IN' | 'CHECK_OUT'
 * returns object {
 *   dateFolder, sanitizedLicensePlate, basePath, licensePlatePath, truckPhotosPath, documentPhotosPath, otherPhotosPath, relativePaths
 * }
 */
/**
 * 📂 Helper — Create Folder Structure for Truck Uploads
 * createUploadFolder(truckId)
 * Returns object {
 *   basePath
 * }
 */
export const createUploadFolder = (truckId = null) => {
  try {
    // Structure v3: /uploads/trucks/{truckId}/
    const safeId = String(truckId || "new")
      .trim()
      .replace(/[^a-zA-Z0-9-_]/g, "_");

    // Base upload path
    const baseUploadPath =
      process.env.UPLOAD_PATH || path.join(__dirname, "../../uploads/trucks/");

    const truckPath = path.join(baseUploadPath, safeId);

    // Create folder if missing
    if (!fs.existsSync(truckPath)) {
      fs.mkdirSync(truckPath, { recursive: true });
      console.log(`📁 Created folder: ${truckPath}`);
    }

    return {
      basePath: truckPath,
      relativePaths: {
        // Just return base relative path, the caller (multer filename) handles file naming prefix
        base: path
          .relative(path.join(__dirname, "../../uploads/trucks"), truckPath)
          .replace(/\\/g, "/"),
      },
    };
  } catch (error) {
    console.error(
      "❌ Error creating upload folder:",
      error && (error.stack || error),
    );
    throw new Error("Failed to create upload folder structure");
  }
};

/**
 * 🧭 Helper — Get Folder Path Based on Upload Field Name
 * Now simply returns the base path as all files go into the same folder
 */
export const getPhotoTypeFolder = (field, folderInfo) => {
  return folderInfo.basePath;
};

export default {
  initDatabase,
  getPool,
  dbHelpers,
  createUploadFolder,
  getPhotoTypeFolder,
};
