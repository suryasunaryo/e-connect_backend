import { dbHelpers, initDatabase } from "./config/database.js";

const check = async () => {
  await initDatabase();

  console.log("\n--- USERS TABLE ---");
  try {
    const userCols = await dbHelpers.query("SHOW COLUMNS FROM users");
    console.table(userCols);
  } catch (err) {
    console.error("Users table error:", err.message);
  }

  console.log("\n--- USERS_ROLE TABLE ---");
  try {
    const roleCols = await dbHelpers.query("SHOW COLUMNS FROM users_role");
    console.table(roleCols);
  } catch (err) {
    console.error("Users_role table error:", err.message);
  }

  process.exit(0);
};
check();
