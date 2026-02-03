import { dbHelpers, initDatabase } from "../src/config/database.js";

const inspect = async () => {
  try {
    await initDatabase();
    const result = await dbHelpers.query("DESCRIBE work_calendar");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

inspect();
