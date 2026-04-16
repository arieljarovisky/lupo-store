/** Resuelve credenciales desde DATABASE_URL / MYSQL_URL (Railway) o variables sueltas. */

export interface MysqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  useSsl: boolean;
}

function parseDatabaseUrl(raw: string): Omit<MysqlConnectionConfig, 'useSsl'> {
  let urlString = raw.trim();
  if (!urlString.includes('://')) {
    urlString = `mysql://${urlString}`;
  }
  const u = new URL(urlString);
  const database = u.pathname.replace(/^\//, '').split('/')[0]?.split('?')[0];
  if (!database) {
    throw new Error('La URL de MySQL debe incluir el nombre de la base al final (ej. mysql://.../nombre_base).');
  }
  const user = decodeURIComponent(u.username || '');
  const password = decodeURIComponent(u.password || '');
  if (!user) {
    throw new Error('La URL de MySQL debe incluir usuario.');
  }
  return {
    host: u.hostname || '127.0.0.1',
    port: u.port ? Number(u.port) : 3306,
    user,
    password,
    database,
  };
}

export function resolveMysqlConnectionConfig(): MysqlConnectionConfig {
  const url = process.env.DATABASE_URL?.trim() || process.env.MYSQL_URL?.trim();
  const ms = process.env.MYSQL_SSL?.trim();
  const sslEnv = ms === '1' || ms?.toLowerCase() === 'true';

  if (url) {
    const base = parseDatabaseUrl(url);
    return { ...base, useSsl: sslEnv };
  }

  const host =
    process.env.MYSQL_HOST?.trim() ||
    process.env.MYSQLHOST?.trim() ||
    '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT || process.env.MYSQLPORT || '3306') || 3306;
  const user = process.env.MYSQL_USER?.trim() || process.env.MYSQLUSER?.trim();
  const password = process.env.MYSQL_PASSWORD ?? process.env.MYSQLPASSWORD ?? '';
  const database =
    process.env.MYSQL_DATABASE?.trim() || process.env.MYSQLDATABASE?.trim();

  if (!user || !database) {
    throw new Error(
      'Configurá DATABASE_URL o MYSQL_URL, o bien MYSQL_USER y MYSQL_DATABASE (y host/puerto si aplica).'
    );
  }

  return {
    host,
    port,
    user,
    password,
    database,
    useSsl: sslEnv,
  };
}
