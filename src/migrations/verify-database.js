import { dbHelpers } from "../config/database.js";

const verifyDatabase = async () => {
  console.log("🔍 Verifying database setup...");

  try {
    // Test users table
    const users = await dbHelpers.query("SELECT COUNT(*) as count FROM users");
    console.log(`✅ Users table: ${users[0].count} users found`);

    // Test trucks table
    const trucks = await dbHelpers.query(
      "SELECT COUNT(*) as count FROM trucks"
    );
    console.log(`✅ Trucks table: ${trucks[0].count} trucks found`);

    // Test sample data
    const sampleTrucks = await dbHelpers.query(`
      SELECT status, COUNT(*) as count 
      FROM trucks 
      GROUP BY status
    `);

    console.log("📊 Truck status summary:");
    sampleTrucks.forEach((row) => {
      console.log(`   ${row.status}: ${row.count} trucks`);
    });

    console.log("🎉 Database verification completed successfully!");
  } catch (error) {
    console.error("❌ Database verification failed:", error.message);
    process.exit(1);
  }
};

verifyDatabase();
