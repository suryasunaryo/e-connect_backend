import { initDatabase, dbHelpers } from "./src/config/database.js";

const run = async () => {
  try {
    await initDatabase();

    console.log("Checking schema for calendar_event_types...");
    const result = await dbHelpers.query(
      "SHOW CREATE TABLE calendar_event_types",
    );
    console.log("Create Table SQL:", result[0]["Create Table"]);

    process.exit(0);
  } catch (error) {
    console.error("Schema check failed:", error);
    process.exit(1);
  }
};

run();
