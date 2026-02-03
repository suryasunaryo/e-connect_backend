import { initDatabase, dbHelpers } from "./src/config/database.js";

const run = async () => {
  try {
    await initDatabase();

    console.log("Checking column definition...");
    const result = await dbHelpers.query(
      "SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_NAME = 'calendar_event_types' AND COLUMN_NAME = 'auto_target_type'",
    );
    console.log("Column Info:", result);

    process.exit(0);
  } catch (error) {
    console.error("Check failed:", error);
    process.exit(1);
  }
};

run();
