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
    } else {
      console.log("✅ Tables already exist");
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_nik (nik),
          INDEX idx_date (attendance_date)
        )
      `);
      console.log("✅ attendance_log table created successfully");
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

      // event_colors.event_type
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
          "ALTER TABLE employees ADD COLUMN employee_shift_id INT NULL AFTER location_id",
        );
      }
    } catch (migErr) {
      console.warn(
        "Migration warning (employees setup columns):",
        migErr.message,
      );
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
