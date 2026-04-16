import mysql from 'mysql2/promise';
import type { MysqlConnectionConfig } from './mysqlConfig.js';

const SAFE_DB = /^[a-zA-Z0-9_]+$/;

/**
 * Crea la base si no existe (CREATE DATABASE IF NOT EXISTS).
 * En Railway/MySQL administrado a veces la base ya viene creada o el usuario no tiene CREATE: en ese caso se ignora el error y sigue el arranque.
 */
export async function ensureDatabaseExists(cfg: MysqlConnectionConfig): Promise<void> {
  const auto = process.env.AUTO_CREATE_DATABASE?.trim();
  if (auto === '0' || auto?.toLowerCase() === 'false') {
    return;
  }
  if (!SAFE_DB.test(cfg.database)) {
    throw new Error(
      'El nombre de la base de datos solo puede tener letras, números y guión bajo (sin espacios ni guiones).'
    );
  }

  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    ssl: cfg.useSsl ? {} : undefined,
  });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`[mysql] Base de datos lista: ${cfg.database}`);
  } catch (e) {
    console.warn(
      '[mysql] No se pudo ejecutar CREATE DATABASE (si la base ya existe o el usuario no tiene permiso, puede ignorarse):',
      e instanceof Error ? e.message : e
    );
  } finally {
    await conn.end();
  }
}
