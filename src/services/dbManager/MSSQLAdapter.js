import tedious from "tedious";
const { Connection, Request } = tedious;
import { BaseAdapter } from "./BaseAdapter.js";

export class MSSQLAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.connection = null;
  }

  async connect() {
    if (this.connection) return this.connection;

    return new Promise((resolve, reject) => {
      let host = this.config.host;
      let instanceName = null;

      // Detect named instance (e.g., INFORDB\MSSQL)
      if (host.includes("\\")) {
        [host, instanceName] = host.split("\\");
      }

      const tediousConfig = {
        server: host,
        authentication: {
          type: "default",
          options: {
            userName: this.config.username,
            password: this.config.password,
          },
        },
        options: {
          database: this.config.database_name || "master", // Default to master
          trustServerCertificate: true,
          encrypt: Boolean(this.config.ssl_enabled),
          connectTimeout: (this.config.timeout || 30) * 1000,
          rowCollectionOnRequestCompletion: true,
        },
      };

      if (instanceName) {
        tediousConfig.options.instanceName = instanceName;
      } else {
        tediousConfig.options.port = parseInt(this.config.port) || 1433;
      }

      const conn = new Connection(tediousConfig);

      conn.on("connect", (err) => {
        if (err) {
          reject(new Error(`MSSQL Connection Failed: ${err.message}`));
        } else {
          this.connection = conn;
          resolve(conn);
        }
      });

      conn.connect();
    });
  }

  async testConnection() {
    try {
      await this.connect();
      await this.disconnect();
      return true;
    } catch (error) {
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
  }

  async getTables() {
    const conn = await this.connect();
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT s.name AS schema_name, t.name AS table_name 
        FROM sys.tables t 
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE s.name NOT IN ('sys', 'information_schema')
        ORDER BY s.name, t.name`;

      const request = new Request(sql, (err, rowCount, rows) => {
        if (err) {
          reject(new Error(`Failed to fetch MSSQL tables: ${err.message}`));
        } else {
          const tables = rows.map((row) => ({
            name: `${row[0].value}.${row[1].value}`,
          }));
          resolve(tables);
        }
      });
      conn.execSql(request);
    });
  }

  async executeQuery(sql, params = []) {
    const conn = await this.connect();
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const request = new Request(sql, (err, rowCount, rows) => {
        const executionTime = Date.now() - startTime;
        if (err) {
          reject(new Error(`MSSQL Query Error: ${err.message}`));
        } else {
          // High-performance manual conversion for large result sets
          const rowsCount = rows.length;
          const resultRows = new Array(rowsCount);
          for (let i = 0; i < rowsCount; i++) {
            const row = rows[i];
            const obj = {};
            const colCount = row.length;
            const nameCount = {}; // To handle duplicate column names

            for (let j = 0; j < colCount; j++) {
              const col = row[j];
              let colName = col.metadata.colName || `Column_${j + 1}`;

              // Handle duplicate column names
              if (nameCount[colName] !== undefined) {
                nameCount[colName]++;
                colName = `${colName}_${nameCount[colName]}`;
              } else {
                nameCount[colName] = 0;
              }

              obj[colName] = col.value;
            }
            resultRows[i] = obj;
          }

          resolve({
            rows: resultRows,
            executionTime,
            rowCount: rowCount,
          });
        }
      });

      // Add params if any
      // Note: MSSQL (tedious) uses named params usually, but we'll try to support positional if possible
      // This part might need enhancement based on how users provide params

      conn.execSql(request);
    });
  }

  async getDatabases() {
    const conn = await this.connect();
    return new Promise((resolve, reject) => {
      const sql = "SELECT name FROM sys.databases WHERE database_id > 4";
      const request = new Request(sql, (err, rowCount, rows) => {
        if (err) {
          reject(new Error(`Failed to fetch MSSQL databases: ${err.message}`));
        } else {
          const databases = rows.map((row) => row[0].value);
          resolve(databases);
        }
      });
      conn.execSql(request);
    });
  }
}
