import { dbHelpers, initDatabase } from "./config/database.js";

const fix = async () => {
  let pool;
  try {
    pool = await initDatabase();

    console.log("🛠 Disable FK checks");
    await dbHelpers.execute("SET FOREIGN_KEY_CHECKS = 0");

    console.log("🛠 ALTER NEWS ID to CHAR(36)");
    // Try modifying. If it fails due to auto_increment, we might need to handle that.
    // Usually MODIFY removes auto_increment if not specified.
    await dbHelpers.execute(
      "ALTER TABLE news MODIFY COLUMN id CHAR(36) NOT NULL",
    );

    console.log("🛠 ALTER news_targets.target_value to TEXT");
    await dbHelpers.execute(
      "ALTER TABLE news_targets MODIFY COLUMN target_value TEXT",
    );

    console.log("🛠 ALTER news.content to LONGTEXT");
    await dbHelpers.execute("ALTER TABLE news MODIFY COLUMN content LONGTEXT");

    console.log("🛠 ALTER news_targets.news_id to CHAR(36)");
    await dbHelpers.execute(
      "ALTER TABLE news_targets MODIFY COLUMN news_id CHAR(36) NOT NULL",
    );

    console.log("🛠 ALTER news_files.news_id to CHAR(36)");
    await dbHelpers.execute(
      "ALTER TABLE news_files MODIFY COLUMN news_id CHAR(36) NOT NULL",
    );

    console.log("🛠 ALTER news_read.news_id to CHAR(36)");
    await dbHelpers.execute(
      "ALTER TABLE news_read MODIFY COLUMN news_id CHAR(36) NOT NULL",
    );

    console.log("✅ ALTER Success");

    console.log("🛠 Enable FK checks");
    await dbHelpers.execute("SET FOREIGN_KEY_CHECKS = 1");

    process.exit(0);
  } catch (error) {
    console.error("❌ FAILED:", error);
    process.exit(1);
  }
};

fix();
