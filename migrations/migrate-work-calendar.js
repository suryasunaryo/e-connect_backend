// Safe migration script to update work_calendar table with new event types
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "e_connect",
};

async function runMigration() {
  let connection;

  try {
    console.log("🔄 Connecting to database...");
    connection = await mysql.createConnection(dbConfig);
    console.log("✅ Connected to database");

    // Step 1: Check if there's existing data
    console.log("\n📋 Checking existing data...");
    const [existingData] = await connection.execute(
      "SELECT COUNT(*) as count FROM work_calendar WHERE deleted_at IS NULL"
    );
    console.log(`Found ${existingData[0].count} existing records`);

    if (existingData[0].count > 0) {
      console.log("\n⚠️  WARNING: Found existing data in work_calendar table");
      console.log("📋 Listing existing records:");
      const [records] = await connection.execute(
        "SELECT id, date, type, description FROM work_calendar WHERE deleted_at IS NULL LIMIT 10"
      );
      console.table(records);

      console.log("\n🗑️  Soft-deleting all existing records...");
      await connection.execute(
        "UPDATE work_calendar SET deleted_at = CURRENT_TIMESTAMP WHERE deleted_at IS NULL"
      );
      console.log("✅ Existing records soft-deleted");
    }

    // Step 2: Drop unique constraint temporarily
    console.log("\n🔧 Dropping unique constraint...");
    try {
      await connection.execute(
        "ALTER TABLE work_calendar DROP INDEX unique_date"
      );
      console.log("✅ Unique constraint dropped");
    } catch (error) {
      if (error.code === "ER_CANT_DROP_FIELD_OR_KEY") {
        console.log("ℹ️  Unique constraint already dropped or doesn't exist");
      } else {
        throw error;
      }
    }

    // Step 3: Modify ENUM column
    console.log("\n🔧 Updating type column with new ENUM values...");
    await connection.execute(`
      ALTER TABLE work_calendar 
      MODIFY COLUMN type ENUM(
        'company_anniversary', 
        'replacement_workday', 
        'replacement_holiday', 
        'sto_audit'
      ) NOT NULL
    `);
    console.log("✅ Type column updated");

    // Step 4: Re-add unique constraint
    console.log("\n🔧 Re-adding unique constraint...");
    await connection.execute(
      "ALTER TABLE work_calendar ADD UNIQUE KEY unique_date (date)"
    );
    console.log("✅ Unique constraint re-added");

    // Step 5: Verify the change
    console.log("\n📋 Verifying changes...");
    const [newColumns] = await connection.execute(
      "SHOW COLUMNS FROM work_calendar LIKE 'type'"
    );
    console.log("Updated type column:");
    console.table([newColumns[0]]);

    // Step 6: Create event_colors table if not exists
    console.log("\n🔧 Creating event_colors table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS event_colors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_type ENUM(
          'company_anniversary', 
          'replacement_workday', 
          'replacement_holiday', 
          'sto_audit', 
          'national_holiday', 
          'cuti_bersama'
        ) NOT NULL UNIQUE,
        color VARCHAR(7) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ event_colors table created/verified");

    // Step 7: Insert default colors
    console.log("\n🎨 Inserting default colors...");
    await connection.execute(`
      INSERT IGNORE INTO event_colors (event_type, color) VALUES
      ('company_anniversary', '#8B5CF6'),
      ('replacement_workday', '#3B82F6'),
      ('replacement_holiday', '#F59E0B'),
      ('sto_audit', '#10B981'),
      ('national_holiday', '#EF4444'),
      ('cuti_bersama', '#F97316')
    `);
    console.log("✅ Default colors inserted");

    // Step 8: Verify event_colors
    console.log("\n📋 Verifying event_colors...");
    const [colors] = await connection.execute(
      "SELECT * FROM event_colors ORDER BY event_type"
    );
    console.log("Event colors:");
    console.table(colors);

    console.log("\n✅ Migration completed successfully!");
    console.log(
      "\nℹ️  Note: Old records were soft-deleted. You can restore them manually if needed."
    );
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    console.error("\nError details:", {
      code: error.code,
      errno: error.errno,
      sqlMessage: error.sqlMessage,
      sql: error.sql,
    });
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log("\n🔌 Database connection closed");
    }
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log("\n🎉 All done! You can now use the new event types.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Migration error. Please check the error above.");
    process.exit(1);
  });
