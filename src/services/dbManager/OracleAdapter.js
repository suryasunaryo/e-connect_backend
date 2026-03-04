import oracledb from "oracledb";
import { BaseAdapter } from "./BaseAdapter.js";

export class OracleAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.connection = null;
  }

  async connect() {
    if (this.connection) return this.connection;

    try {
      this.connection = await oracledb.getConnection({
        user: this.config.username,
        password: this.config.password,
        connectString: `${this.config.host}:${this.config.port || 1521}/${this.config.database_name}`,
      });
      return this.connection;
    } catch (error) {
      this.connection = null;
      throw new Error(`Oracle Connection Failed: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      const conn = await oracledb.getConnection({
        user: this.config.username,
        password: this.config.password,
        connectString: `${this.config.host}:${this.config.port || 1521}/${this.config.database_name}`,
      });
      await conn.execute("SELECT 1 FROM DUAL");
      await conn.close();
      return true;
    } catch (error) {
      throw new Error(`Test Connection Failed: ${error.message}`);
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async getTables() {
    const conn = await this.connect();
    try {
      const sql = "SELECT table_name FROM all_tables WHERE owner = :owner";
      const owner = (
        this.config.db_schema || this.config.username
      ).toUpperCase();
      const result = await conn.execute(sql, [owner]);
      return result.rows.map((r) => ({ name: r[0] }));
    } catch (error) {
      throw new Error(`Failed to fetch Oracle tables: ${error.message}`);
    }
  }

  async executeQuery(sql, params = []) {
    const conn = await this.connect();
    const startTime = Date.now();
    try {
      const options = {
        autoCommit: true,
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      };
      const result = await conn.execute(sql, params, options);
      const executionTime = Date.now() - startTime;
      return {
        rows: result.rows,
        executionTime,
        rowCount: result.rows ? result.rows.length : result.rowsAffected || 0,
      };
    } catch (error) {
      throw new Error(`Oracle Query Error: ${error.message}`);
    }
  }
}
