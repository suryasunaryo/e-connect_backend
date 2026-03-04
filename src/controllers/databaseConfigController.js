import { dbHelpers } from "../config/database.js";
import { DatabaseFactory } from "../services/dbManager/DatabaseFactory.js";
import { encrypt, decrypt } from "../utils/encryption.js";

/**
 * Controller for Managing Database Connections
 */

// List all connections
export const getAllConnections = async (req, res) => {
  try {
    const connections = await dbHelpers.query(
      "SELECT id, name, db_type, host, port, database_name, is_active FROM database_connections WHERE is_deleted = 0",
    );
    res.json(connections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single connection
export const getConnection = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await dbHelpers.queryOne(
      "SELECT * FROM database_connections WHERE id = ? AND is_deleted = 0",
      [id],
    );

    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    // Decrypt password before sending to frontend if needed (usually we don't send it back)
    // For editing, we might need it, or just send a placeholder
    connection.password = "********";
    res.json(connection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create connection
export const createConnection = async (req, res) => {
  try {
    const {
      name,
      db_type,
      network_type,
      host,
      port,
      database_name,
      username,
      password,
      ssl_enabled,
      timeout,
      charset,
      db_schema,
      additional_params,
    } = req.body;

    const encryptedPassword = encrypt(password);

    const result = await dbHelpers.execute(
      `INSERT INTO database_connections (
        name, db_type, network_type, host, port, 
        database_name, username, password, ssl_enabled, 
        timeout, charset, db_schema, additional_params
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        db_type,
        network_type,
        host,
        port,
        database_name,
        username,
        encryptedPassword,
        ssl_enabled ? 1 : 0,
        timeout || 30,
        charset || "utf8mb4",
        db_schema,
        additional_params ? JSON.stringify(additional_params) : null,
      ],
    );

    res.status(201).json({
      id: result.insertId,
      message: "Connection created successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Test connection (before saving or for existing)
export const testConnection = async (req, res) => {
  try {
    const config = req.body;

    // If testing existing connection by ID
    if (config.id && !config.password) {
      const existing = await dbHelpers.queryOne(
        "SELECT * FROM database_connections WHERE id = ?",
        [config.id],
      );
      if (existing) {
        config.password = decrypt(existing.password);
        config.db_type = existing.db_type;
        config.host = existing.host;
        config.port = existing.port;
        config.username = existing.username;
        config.database_name = existing.database_name;
        // ... extend as needed
      }
    }

    const adapter = DatabaseFactory.createAdapter(config);
    const success = await adapter.testConnection();

    res.json({ success, message: "Connection test successful" });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Discover available databases on host
export const discoverDatabases = async (req, res) => {
  try {
    const config = req.body;
    const adapter = DatabaseFactory.createAdapter(config);
    const databases = await adapter.getDatabases();
    res.json(databases);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get tables for a connection
export const getTables = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await dbHelpers.queryOne(
      "SELECT * FROM database_connections WHERE id = ?",
      [id],
    );

    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    connection.password = decrypt(connection.password);
    const adapter = DatabaseFactory.createAdapter(connection);
    const tables = await adapter.getTables();

    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Execute query
export const executeQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const { sql, params } = req.body;

    const connection = await dbHelpers.queryOne(
      "SELECT * FROM database_connections WHERE id = ?",
      [id],
    );

    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    connection.password = decrypt(connection.password);
    const adapter = DatabaseFactory.createAdapter(connection);
    const result = await adapter.executeQuery(sql, params);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete connection
export const deleteConnection = async (req, res) => {
  try {
    const { id } = req.params;
    await dbHelpers.execute(
      "UPDATE database_connections SET is_deleted = 1, deleted_at = NOW() WHERE id = ?",
      [id],
    );
    res.json({ message: "Connection deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- Saved Queries ---

// Save a query
export const saveQuery = async (req, res) => {
  try {
    const { connection_id, name, sql_query } = req.body;

    if (!connection_id || !name || !sql_query) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await dbHelpers.execute(
      "INSERT INTO database_saved_queries (connection_id, name, sql_query) VALUES (?, ?, ?)",
      [connection_id, name, sql_query],
    );

    res.status(201).json({
      id: result.insertId,
      message: "Query saved successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get saved queries for a connection
export const getSavedQueries = async (req, res) => {
  try {
    const { id: connection_id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch user's department to allow department-based targeting
    const userDetails = await dbHelpers.queryOne(
      "SELECT department_id FROM employees WHERE user_id = ? OR nik = ?",
      [userId, req.user.username],
    );
    const deptId = userDetails?.department_id;

    // If user is admin (role 'admin' or '30' or '1'), show everything
    const isAdmin =
      userRole === "admin" || userRole === "30" || userRole === "1";

    let sql = `
      SELECT * FROM database_saved_queries 
      WHERE connection_id = ? AND is_active = 1
    `;
    const params = [connection_id];

    if (!isAdmin) {
      sql += `
        AND (
          target_type = 'all'
          OR (target_type = 'role' AND FIND_IN_SET(?, target_value))
          OR (target_type = 'user' AND FIND_IN_SET(?, target_value))
          OR (target_type = 'department' AND FIND_IN_SET(?, target_value))
        )
      `;
      params.push(userRole, userId, deptId);
    }

    sql += " ORDER BY created_at DESC";

    const queries = await dbHelpers.query(sql, params);
    res.json(queries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a saved query
export const deleteSavedQuery = async (req, res) => {
  try {
    const { id } = req.params;

    await dbHelpers.execute("DELETE FROM database_saved_queries WHERE id = ?", [
      id,
    ]);

    res.json({ message: "Saved query deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Get all saved queries (Management view)
export const getAllSavedQueriesManagement = async (req, res) => {
  try {
    const queries = await dbHelpers.query(`
      SELECT q.*, c.name as connection_name 
      FROM database_saved_queries q
      JOIN database_connections c ON q.connection_id = c.id
      WHERE c.is_deleted = 0
      ORDER BY q.created_at DESC
    `);
    res.json(queries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a saved query (Permissions & Status)
export const updateSavedQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, target_type, target_value, is_active } = req.body;

    await dbHelpers.execute(
      `UPDATE database_saved_queries 
       SET name = ?, target_type = ?, target_value = ?, is_active = ? 
       WHERE id = ?`,
      [name, target_type, target_value, is_active ? 1 : 0, id],
    );

    res.json({ message: "Saved query updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
