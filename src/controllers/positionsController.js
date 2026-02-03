// controllers/positionsController.js
import { dbHelpers } from "../config/database.js";

/**
 * GET ALL POSITIONS
 */
export const getAllPositions = async (req, res) => {
  try {
    const positions = await dbHelpers.query(`
      SELECT 
        p.*,
        b.branch_name,
        parent.position_name as parent_position_name
      FROM positions p
      LEFT JOIN branches b ON p.branch_id = b.id
      LEFT JOIN positions parent ON p.parent_id = parent.id
      WHERE p.deleted_at IS NULL 
      ORDER BY p.position_name ASC
    `);
    res.json(positions);
  } catch (error) {
    console.error("❌ Error fetching positions:", error);
    res.status(500).json({ error: "Failed to fetch positions" });
  }
};

/**
 * GET POSITIONS BY BRANCH
 */
export const getPositionsByBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const positions = await dbHelpers.query(
      `
      SELECT 
        p.id,
        p.position_name as name
      FROM positions p
      WHERE p.branch_id = ? AND p.deleted_at IS NULL 
      ORDER BY p.position_name ASC
    `,
      [branchId]
    );
    res.json(positions);
  } catch (error) {
    console.error("❌ Error fetching positions by branch:", error);
    res.status(500).json({ error: "Failed to fetch positions" });
  }
};
