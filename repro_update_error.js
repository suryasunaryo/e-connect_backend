import { initDatabase, dbHelpers } from "./src/config/database.js";
import { emitDataChange } from "./src/utils/socketHelpers.js";

const run = async () => {
  try {
    await initDatabase();

    // Simulate the payload that might be failing
    const id = 4; // Based on error log
    const params = [
      "Audit STO", // name
      "Audit", // category
      "#EAB308", // color
      "", // auto_target_type (empty string test)
      "", // auto_target_value (empty string test)
      true, // is_active
      id, // id
    ];

    console.log("Testing UPDATE query with params:", params);

    await dbHelpers.query(
      `UPDATE calendar_event_types 
             SET name = ?, category = ?, color = ?, auto_target_type = ?, 
                 auto_target_value = ?, is_active = ? 
             WHERE id = ?`,
      params,
    );

    console.log("Update successful!");

    console.log("Testing emitDataChange...");
    emitDataChange("calendar_event_types", "update", { id, name: "Audit STO" });
    console.log("Emit successful!");

    process.exit(0);
  } catch (error) {
    console.error("Update failed:", error);
    process.exit(1);
  }
};

run();
