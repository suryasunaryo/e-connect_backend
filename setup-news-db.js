import { initDatabase, getPool } from "./src/config/database.js";

const setupNewsTables = async () => {
  try {
    await initDatabase();
    const pool = getPool();
    const conn = await pool.getConnection();

    console.log("🛠 Checking News Tables...");

    // 0. Cleanup (Dev only - since we are refining schema)
    await conn.execute("SET FOREIGN_KEY_CHECKS = 0");
    await conn.execute("DROP TABLE IF EXISTS news_read");
    await conn.execute("DROP TABLE IF EXISTS news_files");
    await conn.execute("DROP TABLE IF EXISTS news_targets");
    await conn.execute("DROP TABLE IF EXISTS news");
    await conn.execute("SET FOREIGN_KEY_CHECKS = 1");

    // 1. Table News
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS news (
        id CHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content LONGTEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
        publish_at DATETIME NULL,
        close_date DATETIME NULL,
        created_by INT NULL,
        allow_comments BOOLEAN DEFAULT FALSE,
        pin_top BOOLEAN DEFAULT FALSE,
        priority ENUM('normal', 'high', 'urgent') DEFAULT 'normal',
        view_count INT DEFAULT 0,
        cover_image TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log("✅ Table 'news' checked/created.");

    // 2. Table News Targets
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS news_targets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        news_id CHAR(36) NOT NULL,
        target_type ENUM('all', 'user', 'department', 'role', 'branch', 'position') NOT NULL,
        target_value TEXT NULL, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
      )
    `);
    console.log("✅ Table 'news_targets' checked/created.");
    // Note: target_value can be user_id, dept_id, or role_name. Kept as VARCHAR to be flexible or INT if strictly ID.
    // Given the previous conversation, departments have IDs, Users have IDs. Roles are ENUMs in users table?
    // In userController.js: role ENUM('admin','operator','viewer').
    // And there is a users_role table mentioned in createUser: "SELECT menu_groups, menu_access FROM users_role WHERE role_id = ?"
    // So role might be an ID or string. Let's assume ID for dept/user and String/ID for role. VARCHAR(255) is safe.

    // 3. Table News Files
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS news_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        news_id CHAR(36) NOT NULL,
        file_path TEXT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_type ENUM('image', 'attachment') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
      )
    `);
    console.log("✅ Table 'news_files' checked/created.");

    // 4. Table News Read
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS news_read (
        id INT AUTO_INCREMENT PRIMARY KEY,
        news_id CHAR(36) NOT NULL,
        user_id INT NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_read (news_id, user_id)
      )
    `);
    console.log("✅ Table 'news_read' checked/created.");

    conn.release();
    console.log("🎉 News tables setup complete.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error setting up news tables:", error);
    process.exit(1);
  }
};

setupNewsTables();
