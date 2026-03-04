import mysql from "mysql2/promise";
import { BaseAdapter } from "./BaseAdapter.js";

export class MySQLAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.pool = null;
  }

  async connect() {
    if (this.pool) return this.pool;

    try {
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port || 3306,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database_name,
        waitForConnections: true,
        connectionLimit: 1, // Limited for query manager
        queueLimit: 0,
        connectTimeout: (this.config.timeout || 30) * 1000,
        charset: this.config.charset || "utf8mb4",
      });

      // Quick test
      const [rows] = await this.pool.execute("SELECT 1");
      return this.pool;
    } catch (error) {
      this.pool = null;
      throw new Error(`MySQL Connection Failed: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      const conn = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port || 3306,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database_name || undefined, // Allow empty
        connectTimeout: (this.config.timeout || 10) * 1000,
      });
      await conn.execute("SELECT 1");
      await conn.end();
      return true;
    } catch (error) {
      throw new Error(`Test Connection Failed: ${error.message}`);
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async getTables() {
    await this.connect();
    try {
      const [rows] = await this.pool.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
        [this.config.database_name],
      );
      return rows.map((r) => ({ name: r.TABLE_NAME || r.table_name }));
    } catch (error) {
      throw new Error(`Failed to fetch tables: ${error.message}`);
    }
  }

  async executeQuery(sql, params = []) {
    await this.connect();
    const startTime = Date.now();
    try {
      const [rows] = await this.pool.query(sql, params);
      const executionTime = Date.now() - startTime;
      return {
        rows: Array.isArray(rows) ? rows : [rows],
        executionTime,
        rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows || 0,
      };
    } catch (error) {
      throw new Error(`Query Error: ${error.message}`);
    }
  }

  async getDatabases() {
    try {
      const conn = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port || 3306,
        user: this.config.username,
        password: this.config.password,
        connectTimeout: (this.config.timeout || 10) * 1000,
      });
      const [rows] = await conn.execute("SHOW DATABASES");
      await conn.end();
      return rows.map((r) => r.Database || r.database);
    } catch (error) {
      throw new Error(`Failed to fetch MySQL databases: ${error.message}`);
    }
  }
}
