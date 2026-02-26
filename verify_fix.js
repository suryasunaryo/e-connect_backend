import { dbHelpers, initDatabase } from "./src/config/database.js";
import bcrypt from "bcryptjs";

async function verifyFix() {
  try {
    await initDatabase();
    const pool = await dbHelpers.getPool();
    const connection = await pool.getConnection();

    const role = "32"; // From the error log
    const password = "testpassword";
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Get Peggy's info
    const [employees] = await connection.query(
      "SELECT * FROM employees WHERE nik = '0000003'",
    );
    const emp = employees[0];

    if (!emp) {
      console.log("❌ Peggy not found in employees");
      process.exit(1);
    }

    console.log(`Testing with employee: ${emp.full_name} (${emp.nik})`);

    // Simulate the new logic
    const [existingUser] = await connection.query(
      "SELECT id FROM users WHERE username = ?",
      [emp.nik],
    );

    if (existingUser.length > 0) {
      console.log(`✅ Correctly identified existing username: ${emp.nik}`);
    } else {
      console.log(
        `ℹ️ Username ${emp.nik} does not exist yet (expected if user_id is NULL)`,
      );
    }

    const empEmail = emp.office_email || emp.personal_email || null;
    console.log(`Checking email: ${empEmail}`);

    if (empEmail) {
      const [existingEmail] = await connection.query(
        "SELECT id FROM users WHERE email = ?",
        [empEmail],
      );

      if (existingEmail.length > 0) {
        console.log(
          `✅ SUCCESS: Correctly identified duplicate email ${empEmail}. This employee would be skipped.`,
        );
      } else {
        console.log(
          `❌ FAILED: Email ${empEmail} not found in users. It should have been found.`,
        );
      }
    } else {
      console.log("ℹ️ Employee has no email.");
    }

    connection.release();
    process.exit(0);
  } catch (error) {
    console.error("Error during verification:", error);
    process.exit(1);
  }
}

verifyFix();
