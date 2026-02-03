import { dbHelpers, initDatabase } from "./config/database.js";

const checkSchema = async () => {
  try {
    await initDatabase();
    const tables = ["news", "news_targets", "news_files"];
    for (const table of tables) {
      console.log(`\n--- Schema for ${table} ---`);
      const rows = await dbHelpers.query(`DESCRIBE ${table}`);
      rows.forEach((row) => {
        if (row.Field === "id" || row.Field === "news_id") {
          console.log(`${row.Field}: ${row.Type}`);
        }
      });
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

checkSchema();
