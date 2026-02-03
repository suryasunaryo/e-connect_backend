import { dbHelpers } from "../config/database.js";
import dotenv from "dotenv";
dotenv.config();

const createTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS trucks_out (
        id INT AUTO_INCREMENT PRIMARY KEY,
        truck_id INT NOT NULL,
        document_number VARCHAR(255),
        truck_photos TEXT,
        document_photos TEXT,
        other_photos TEXT,
        notes TEXT,
        created_by INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE CASCADE
      );
    `;
    await dbHelpers.query(query);
    console.log("✅ Table trucks_out created successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to create table:", error);
    console.error("Details:", error.message);
    process.exit(1);
  }
};

createTable();
