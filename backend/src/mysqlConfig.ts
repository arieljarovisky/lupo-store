/** Resuelve credenciales desde URL o variables sueltas (Railway, Docker, local). */

export interface MysqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  useSsl: boolean;
}

function firstUrl(): string | undefined {
  const keys = [
    'DATABASE_URL',
    'MYSQL_URL',
    'MYSQL_PRIVATE_URL',
    'MYSQL_PUBLIC_URL',
    'MYSQLDATABASE_URL',
    'MYSQL_CONNECTION_STRING',
  ] as const;
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

function parseDatabaseUrl(raw: string): Omit<MysqlConnectionConfig, 'useSsl'> {
  let urlString = raw.trim();
  if (!urlString.includes('://')) {
    urlString = `mysql://${urlString}`;
  }
  const u = new URL(urlString);
  const database = u.pathname.replace(/^\//, '').split('/')[0]?.split('?')[0];
  if (!database) {
    throw new Error('La URL de MySQL debe incluir el nombre de la base al final (ej. mysql://usuario:pass@host:puerto/nombre_base).');
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

function inferSsl(host: string): boolean {
  const ms = process.env.MYSQL_SSL?.trim();
  if (ms === '0' || ms?.toLowerCase() === 'false') return false;
  if (ms === '1' || ms?.toLowerCase() === 'true') return true;
  const local = host === '127.0.0.1' || host === 'localhost' || host === '::1';
  if (local) return false;
  if (process.env.RAILWAY_ENVIRONMENT) return true;
  return process.env.MYSQL_SSL_REQUIRED === '1';
}

export function resolveMysqlConnectionConfig(): MysqlConnectionConfig {
  const url = firstUrl();
  if (url) {
    const base = parseDatabaseUrl(url);
    return { ...base, useSsl: inferSsl(base.host) };
  }

  const host =
    process.env.MYSQL_HOST?.trim() ||
    process.env.MYSQLHOST?.trim() ||
    '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT || process.env.MYSQLPORT || '3306') || 3306;
  const user = process.env.MYSQL_USER?.trim() || process.env.MYSQLUSER?.trim();
  const password = process.env.MYSQL_PASSWORD ?? process.env.MYSQLPASSWORD ?? '';
  const database =
    process.env.MYSQL_DATABASE?.trim() ||
    process.env.MYSQLDATABASE?.trim() ||
    process.env.MYSQL_DATABASE_NAME?.trim();

  if (!user || !database) {
    throw new Error(
      'Faltan variables de MySQL. En Railway: creá un plugin MySQL, abrí tu servicio web → Variables → ' +
        '"Add variable reference" y enlazá la URL del MySQL (suele llamarse MYSQL_URL o DATABASE_URL). ' +
        'También podés pegar manualmente DATABASE_URL=mysql://... Local: MYSQL_USER + MYSQL_DATABASE o DATABASE_URL.'
    );
  }

  return {
    host,
    port,
    user,
    password,
    database,
    useSsl: inferSsl(host),
  };
}

function sslRejectConfig(): { rejectUnauthorized: boolean } {
  const strict = process.env.MYSQL_SSL_REJECT_UNAUTHORIZED?.trim()?.toLowerCase();
  if (strict === 'true' || strict === '1') {
    return { rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

function isLocalHost(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

/**
 * TLS para mysql2. En hosts remotos (p. ej. proxy de Railway) el servidor puede forzar TLS aunque
 * `useSsl` sea false por variables no definidas en el contenedor; sin `rejectUnauthorized: false`
 * aparece "self-signed certificate in certificate chain".
 */
export function mysqlSslOptionsForHost(host: string): { rejectUnauthorized: boolean } | undefined {
  const ms = process.env.MYSQL_SSL?.trim()?.toLowerCase();
  if (ms === '0' || ms === 'false') {
    return undefined;
  }

  if (isLocalHost(host)) {
    if (ms === '1' || ms === 'true') {
      return sslRejectConfig();
    }
    return undefined;
  }

  return sslRejectConfig();
}
