/**
 * Base Adapter class for Database Connections
 */
export class BaseAdapter {
  constructor(config) {
    this.config = config;
    this.connection = null;
  }

  /**
   * Test connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    throw new Error("Method 'testConnection()' must be implemented");
  }

  /**
   * Connect to database
   */
  async connect() {
    throw new Error("Method 'connect()' must be implemented");
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    throw new Error("Method 'disconnect()' must be implemented");
  }

  /**
   * Fetch list of tables
   * @returns {Promise<Array>}
   */
  async getTables() {
    throw new Error("Method 'getTables()' must be implemented");
  }

  /**
   * Execute query
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} - { rows, executionTime }
   */
  async executeQuery(sql, params = []) {
    throw new Error("Method 'executeQuery()' must be implemented");
  }

  /**
   * Fetch list of databases on the server
   * @returns {Promise<Array>}
   */
  async getDatabases() {
    throw new Error("Method 'getDatabases()' must be implemented");
  }
}
