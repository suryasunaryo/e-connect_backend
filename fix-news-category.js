import { initDatabase, getPool } from "./src/config/database.js";

const fixNewsTable = async () => {
  try {
    await initDatabase();
    const pool = getPool();
    const conn = await pool.getConnection();

    console.log("🛠 FIXING News Table Schema...");

    // Alter table to widen category column
    await conn.execute(`
      ALTER TABLE news MODIFY COLUMN category VARCHAR(100) NOT NULL;
    `);
    console.log("✅ Column 'category' updated to VARCHAR(100).");

    // Also ensuring status and priority are ENUMs as expected (optional, but good practice)
    // await conn.execute(`
    //   ALTER TABLE news MODIFY COLUMN status ENUM('draft', 'published', 'archived') DEFAULT 'draft';
    // `);

    conn.release();
    console.log("🎉 Migration complete.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing news table:", error);
    process.exit(1);
  }
};

fixNewsTable();
