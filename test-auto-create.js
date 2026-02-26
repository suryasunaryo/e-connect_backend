import { initDatabase } from "./src/config/database.js";
import fs from "fs";

async function test() {
  const pool = await initDatabase();
  const [emps] = await pool.query(
    "SELECT id, nik, full_name, office_email, personal_email, user_id FROM employees WHERE office_email = 'peggy@ciptanissin.co.id' OR personal_email = 'peggy@ciptanissin.co.id'",
  );
  const [users] = await pool.query(
    "SELECT id, username, email FROM users WHERE email = 'peggy@ciptanissin.co.id'",
  );

  fs.writeFileSync("test-dups.json", JSON.stringify({ emps, users }, null, 2));
  process.exit(0);
}
test();
