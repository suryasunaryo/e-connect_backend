import { dbHelpers, initDatabase } from "./src/config/database.js";
import dotenv from "dotenv";

dotenv.config();

const testUserNews = async (userId, role) => {
    try {
        await initDatabase();

        // Simulate req.user
        const user = { id: userId, role: role };

        // Logic from getAllNews
        const status = "published";
        let condition = "WHERE n.deleted_at IS NULL";
        const params = [];

        if (status) {
            condition += " AND n.status = ?";
            params.push(status);
        }

        if (user.role !== "admin") {
            const u = user;
            // Get employee data
            const emp = await dbHelpers.queryOne(
                `SELECT id, department_id, branch_id, position_id 
         FROM employees 
         WHERE user_id = ? AND deleted_at IS NULL`,
                [u.id],
            ) || {};

            const uDept = String(emp.department_id || "");
            const uBranch = String(emp.branch_id || "");
            const uPos = String(emp.position_id || "");

            condition += ` AND (
        n.created_by = ? 
        OR NOT EXISTS (SELECT 1 FROM news_targets WHERE news_id = n.id)
        OR EXISTS (
          SELECT 1 FROM news_targets nt WHERE nt.news_id = n.id AND (
            (nt.target_type = 'all') OR
            (nt.target_type = 'user' AND FIND_IN_SET(?, nt.target_value)) OR
            (nt.target_type = 'department' AND FIND_IN_SET(?, nt.target_value)) OR
            (nt.target_type = 'branch' AND FIND_IN_SET(?, nt.target_value)) OR
            (nt.target_type = 'position' AND FIND_IN_SET(?, nt.target_value)) OR
            (nt.target_type = 'role' AND (FIND_IN_SET(?, nt.target_value) OR FIND_IN_SET(?, nt.target_value)))
          )
        )
      )`;

            params.push(u.id);
            params.push(String(u.id));
            params.push(uDept);
            params.push(uBranch);
            params.push(uPos);
            params.push(String(u.role_id || ""));
            params.push(String(u.role || ""));
        }

        const sql = `
      SELECT n.id, n.title, n.status, n.created_by
      FROM news n
      ${condition}
    `;

        console.log(`Checking news for user ${userId} (role: ${role})...`);
        console.log("SQL Params:", params);
        const rows = await dbHelpers.query(sql, params);
        console.log("Found news items:", rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

// Check for user 19 (the target)
testUserNews(19, "operator");
