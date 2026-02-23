import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";

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

    const [news] = await connection.execute(`
      SELECT n.id, n.title, n.status, n.publish_at, n.created_at,
      (SELECT GROUP_CONCAT(target_type) FROM news_targets WHERE news_id = n.id) as target_types
      FROM news n 
      WHERE n.deleted_at IS NULL 
      ORDER BY n.created_at DESC 
      LIMIT 10
    `);

    let output = "ID | Title | Status | Targets | Publish At | Created At\n";
    output += "---------------------------------------------------------\n";
    news.forEach((row) => {
      output += `${row.id} | ${row.title} | ${row.status} | ${row.target_types} | ${row.publish_at} | ${row.created_at}\n`;
    });

    fs.writeFileSync("temp_news_list.txt", output);
    await connection.end();
    console.log("Output written to temp_news_list.txt");
  } catch (err) {
    console.error(err);
  }
}

run();
