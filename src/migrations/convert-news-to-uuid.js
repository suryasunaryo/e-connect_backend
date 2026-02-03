import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const config = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "e-connect_db",
};

const getForeignKeyName = async (connection, tableName, referencedTable) => {
  const [rows] = await connection.execute(
    `SELECT CONSTRAINT_NAME 
     FROM information_schema.KEY_COLUMN_USAGE 
     WHERE TABLE_NAME = ? 
       AND TABLE_SCHEMA = ? 
       AND REFERENCED_TABLE_NAME = ?`,
    [tableName, config.database, referencedTable]
  );
  return rows.length > 0 ? rows[0].CONSTRAINT_NAME : null;
};

const convertToUuid = async () => {
  console.log("🔄 Starting News UUID Conversion...");
  let connection;

  try {
    connection = await mysql.createConnection(config);
    console.log(`✅ Connected to database: ${config.database}`);

    // Track FK names to restore later
    const tables = ["news_files", "news_targets", "news_comments", "news_read"];
    const fkMap = {};

    console.log("🔍 Checking foreign keys...");
    for (const table of tables) {
      const fkName = await getForeignKeyName(connection, table, "news");
      if (fkName) {
        fkMap[table] = fkName;
        console.log(`   Found FK for ${table}: ${fkName}`);

        // Drop FK
        console.log(`   Dropping FK ${fkName} on ${table}...`);
        await connection.query(
          `ALTER TABLE ${table} DROP FOREIGN KEY ${fkName}`
        );
      } else {
        console.log(
          `   No FK found for ${table} referencing news (might be already dropped or different name)`
        );
      }
    }

    // Disable FK checks globally just in case
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    console.log("💾 Fetching existing news to convert...");
    const [existingNews] = await connection.query("SELECT * FROM news");

    console.log("🛠 Altering tables to CHAR(36)...");

    // Convert columns
    // Use MODIFY matching original definitions but with CHAR(36)
    await connection.query(
      "ALTER TABLE news MODIFY COLUMN id CHAR(36) NOT NULL"
    );

    for (const table of tables) {
      // Assuming news_id is the column name
      // Check if column exists first or just try alter
      try {
        await connection.query(
          `ALTER TABLE ${table} MODIFY COLUMN news_id CHAR(36) NOT NULL`
        );
      } catch (e) {
        console.warn(
          `   Could not modify ${table} (maybe table doesn't exist?):`,
          e.message
        );
      }
    }

    // Convert Data
    if (existingNews.length > 0) {
      console.log(`🔄 Converting ${existingNews.length} news items to UUID...`);
      for (const news of existingNews) {
        const newId = uuidv4();
        const oldId = news.id; // This might be read as 0 or messed up if we already altered type without converting
        // actually since we altered the type, the existing int data is now string "1", "2" etc.
        // So we can still match it.

        // Update records where id matches the old ID (as string)
        await connection.query("UPDATE news SET id = ? WHERE id = ?", [
          newId,
          oldId,
        ]);

        for (const table of tables) {
          try {
            await connection.query(
              `UPDATE ${table} SET news_id = ? WHERE news_id = ?`,
              [newId, oldId]
            );
          } catch (e) {
            // ignore
          }
        }
        console.log(`   Mapped ${oldId} -> ${newId}`);
      }
    }

    console.log("🔗 Re-creating foreign keys...");

    // Re-add FKs
    // news_files -> news
    await connection.query(
      `ALTER TABLE news_files ADD CONSTRAINT fk_news_files_news FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE`
    );
    // news_targets -> news
    await connection.query(
      `ALTER TABLE news_targets ADD CONSTRAINT fk_news_targets_news FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE`
    );
    // news_read -> news
    await connection.query(
      `ALTER TABLE news_read ADD CONSTRAINT fk_news_read_news FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE`
    );

    // news_comments -> news (check if table exists first usually, but assuming it does based on task)
    // Note: comments usually cascade on delete too
    try {
      await connection.query(
        `ALTER TABLE news_comments ADD CONSTRAINT fk_news_comments_news FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE`
      );
    } catch (e) {
      console.warn("Could not add FK for news_comments");
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    if (connection) await connection.end();
  }
};

convertToUuid();
