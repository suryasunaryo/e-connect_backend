import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

async function run() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "e-connect_db",
      port: process.env.DB_PORT || 3306,
    });

    const [dbTime] = await connection.execute(
      "SELECT CURRENT_TIMESTAMP as now",
    );
    console.log(`Database Current Timestamp: ${dbTime[0].now}`);

    console.log("\n--- News Status Details ---");
    const [news] = await connection.execute(`
      SELECT n.id, n.title, n.status, n.publish_at, n.created_at,
      (SELECT GROUP_CONCAT(CONCAT(target_type, ':', IFNULL(target_value, 'NULL'))) FROM news_targets WHERE news_id = n.id) as targets
      FROM news n 
      WHERE n.deleted_at IS NULL 
      ORDER BY n.created_at DESC 
      LIMIT 10
    `);

    news.forEach((row, i) => {
      console.log(`
${i + 1}. TITLE: ${row.title}
   STATUS: ${row.status}
   TARGETS: ${row.targets}
   CREATED: ${row.created_at}
   PUBLISH: ${row.publish_at}`);
    });

    await connection.end();
  } catch (err) {
    console.error(err);
  }
}

run();
