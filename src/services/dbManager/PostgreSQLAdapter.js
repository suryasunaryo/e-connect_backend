import pg from "pg";
const { Pool, Client } = pg;
import { BaseAdapter } from "./BaseAdapter.js";

export class PostgreSQLAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.pool = null;
  }

  async connect() {
    if (this.pool) return this.pool;

    try {
      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port || 5432,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database_name,
        ssl: this.config.ssl_enabled ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: (this.config.timeout || 30) * 1000,
      });

      // Quick test
      await this.pool.query("SELECT 1");
      return this.pool;
    } catch (error) {
      this.pool = null;
      throw new Error(`PostgreSQL Connection Failed: ${error.message}`);
    }
  }

  async testConnection() {
    const client = new Client({
      host: this.config.host,
      port: this.config.port || 5432,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database_name || "postgres", // Default to postgres
      ssl: this.config.ssl_enabled ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: (this.config.timeout || 10) * 1000,
    });

    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return true;
    } catch (error) {
      try {
        await client.end();
      } catch (e) {}
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
      const schema = this.config.db_schema || "public";
      const query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_type = 'BASE TABLE'
      `;
      const result = await this.pool.query(query, [schema]);
      return result.rows.map((r) => ({ name: r.table_name }));
    } catch (error) {
      throw new Error(`Failed to fetch PostgreSQL tables: ${error.message}`);
    }
  }

  async executeQuery(sql, params = []) {
    await this.connect();
    const startTime = Date.now();
    try {
      // Convert params to $1, $2 style if needed (basic string replace if not using pg-native)
      // Note: This relies on the user providing positional parameters if any.
      const result = await this.pool.query(sql, params);
      const executionTime = Date.now() - startTime;
      return {
        rows: result.rows,
        executionTime,
        rowCount: result.rowCount,
      };
    } catch (error) {
      throw new Error(`PostgreSQL Query Error: ${error.message}`);
    }
  }

  async getDatabases() {
    const client = new Client({
      host: this.config.host,
      port: this.config.port || 5432,
      user: this.config.username,
      password: this.config.password,
      database: "postgres", // Must connect to something
      ssl: this.config.ssl_enabled ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: (this.config.timeout || 10) * 1000,
    });

    try {
      await client.connect();
      const result = await client.query(
        "SELECT datname FROM pg_database WHERE datistemplate = false",
      );
      await client.end();
      return result.rows.map((r) => r.datname);
    } catch (error) {
      try {
        await client.end();
      } catch (e) {}
      throw new Error(`Failed to fetch PostgreSQL databases: ${error.message}`);
    }
  }
}
