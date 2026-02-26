import { dbHelpers, initDatabase } from "./src/config/database.js";

async function checkDuplicates() {
  try {
    await initDatabase();
    const email = "peggy@ciptanissin.co.id";
    console.log(`Checking email: ${email}`);

    const employees = await dbHelpers.query(
      "SELECT id, nik, full_name, office_email, personal_email FROM employees WHERE office_email = ? OR personal_email = ?",
      [email, email],
    );
    console.log(
      "Employees with this email:",
      JSON.stringify(employees, null, 2),
    );

    const users = await dbHelpers.query(
      "SELECT id, username, full_name, email FROM users WHERE email = ?",
      [email],
    );
    console.log("Users with this email:", JSON.stringify(users, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkDuplicates();
