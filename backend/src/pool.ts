import mysql from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';
import { ensureDatabaseExists } from './ensureDatabase.js';
import { resolveMysqlConnectionConfig } from './mysqlConfig.js';

let pool: Pool | null = null;
let bootstrapped = false;

export async function getPool(): Promise<Pool> {
  if (pool) return pool;

  const cfg = resolveMysqlConnectionConfig();

  if (!bootstrapped) {
    bootstrapped = true;
    await ensureDatabaseExists(cfg);
  }

  pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    ssl: cfg.useSsl ? {} : undefined,
  });

  return pool;
}
