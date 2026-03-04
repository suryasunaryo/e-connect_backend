import { MySQLAdapter } from "./MySQLAdapter.js";
import { PostgreSQLAdapter } from "./PostgreSQLAdapter.js";
import { MSSQLAdapter } from "./MSSQLAdapter.js";
import { OracleAdapter } from "./OracleAdapter.js";

export class DatabaseFactory {
  /**
   * Create database adapter based on type
   * @param {Object} config - Database configuration
   * @returns {BaseAdapter}
   */
  static createAdapter(config) {
    const { db_type } = config;

    switch (db_type.toLowerCase()) {
      case "mysql":
        return new MySQLAdapter(config);
      case "postgresql":
      case "postgres":
        return new PostgreSQLAdapter(config);
      case "mssql":
      case "sqlserver":
      case "dataverse":
        return new MSSQLAdapter(config);
      case "oracle":
        return new OracleAdapter(config);
      default:
        throw new Error(`Unsupported database type: ${db_type}`);
    }
  }
}
