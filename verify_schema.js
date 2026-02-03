import { initDatabase, dbHelpers } from "./src/config/database.js";

const verifySchema = async () => {
  try {
    await initDatabase();
    const cols = await dbHelpers.query(
      "SHOW COLUMNS FROM work_calendar WHERE Field IN ('auto_target_type', 'auto_target_value')",
    );
    console.log(
      "Found Columns:",
      cols.map((c) => c.Field),
    );
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

verifySchema();
