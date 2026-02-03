import { dbHelpers } from "./src/config/database.js";

async function checkSchema() {
  try {
    const result = await dbHelpers.query("DESCRIBE users");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkSchema();
