import { dbHelpers } from "./src/config/database.js";

async function checkSchema() {
  try {
    const columns = await dbHelpers.query("DESCRIBE users");
    console.log("USERS TABLE COLUMNS:");
    console.table(columns);

    // Also check employees table just in case
    const columnsEmp = await dbHelpers.query("DESCRIBE employees");
    console.log("EMPLOYEES TABLE COLUMNS:");
    console.table(columnsEmp);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkSchema();
