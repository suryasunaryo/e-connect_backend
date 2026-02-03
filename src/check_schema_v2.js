import { dbHelpers, initDatabase } from "./config/database.js";

const check = async () => {
  await initDatabase();

  // Check NEWS table
  console.log("!!!!!!!! CHECKING NEWS TABLE !!!!!!!!!");
  const newsCols = await dbHelpers.query("SHOW COLUMNS FROM news");
  const idCol = newsCols.find((c) => c.Field === "id");
  console.log(`TYPE_NEWS_ID: ${idCol.Type}`);
  console.log(`EXTRA_NEWS_ID: ${idCol.Extra}`);

  // Check NEWS_FILES table
  console.log("!!!!!!!! CHECKING NEWS_FILES TABLE !!!!!!!!!");
  const filesCols = await dbHelpers.query("SHOW COLUMNS FROM news_files");
  const nidCol = filesCols.find((c) => c.Field === "news_id");
  console.log(`TYPE_FILES_NEWS_ID: ${nidCol.Type}`);

  process.exit(0);
};
check();
