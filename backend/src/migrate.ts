import type { Pool, RowDataPacket } from 'mysql2/promise';

async function columnExists(p: Pool, table: string, column: string): Promise<boolean> {
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.cnt) > 0;
}

async function addColumn(
  p: Pool,
  table: string,
  column: string,
  ddl: string
): Promise<void> {
  if (await columnExists(p, table, column)) return;
  await p.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
}

/** Crea tablas nuevas y agrega columnas a `products` si venís de un esquema viejo. */
export async function runMigrations(p: Pool): Promise<void> {
  await p.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(320) DEFAULT NULL,
      phone VARCHAR(32) DEFAULT NULL,
      full_name VARCHAR(255) DEFAULT NULL,
      password_hash VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_customers_email (email),
      KEY idx_customers_phone (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS oauth_identities (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      customer_id BIGINT UNSIGNED NOT NULL,
      provider VARCHAR(32) NOT NULL,
      provider_user_id VARCHAR(255) NOT NULL,
      email_snapshot VARCHAR(320) DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_oauth_provider_user (provider, provider_user_id),
      KEY idx_oauth_customer (customer_id),
      CONSTRAINT fk_oauth_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(320) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) DEFAULT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_admins_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS tiendanube_integrations (
      id TINYINT UNSIGNED NOT NULL,
      store_id VARCHAR(64) NOT NULL,
      access_token TEXT NOT NULL,
      token_type VARCHAR(64) DEFAULT NULL,
      scope VARCHAR(255) DEFAULT NULL,
      user_id VARCHAR(64) DEFAULT NULL,
      connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      customer_id BIGINT UNSIGNED DEFAULT NULL,
      guest_email VARCHAR(320) DEFAULT NULL,
      guest_phone VARCHAR(32) DEFAULT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      payment_status VARCHAR(32) NOT NULL DEFAULT 'unpaid',
      subtotal INT NOT NULL,
      total INT NOT NULL,
      currency VARCHAR(8) NOT NULL DEFAULT 'ARS',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_orders_customer (customer_id),
      KEY idx_orders_created (created_at),
      CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id BIGINT UNSIGNED NOT NULL,
      product_id VARCHAR(64) NOT NULL,
      product_name_snapshot VARCHAR(512) NOT NULL,
      unit_price INT NOT NULL,
      quantity INT NOT NULL,
      line_total INT NOT NULL,
      PRIMARY KEY (id),
      KEY idx_order_items_order (order_id),
      CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(64) NOT NULL,
      name VARCHAR(512) NOT NULL,
      price INT NOT NULL,
      image VARCHAR(2048) NOT NULL DEFAULT '',
      category VARCHAR(255) NOT NULL DEFAULT 'General',
      description TEXT,
      external_id VARCHAR(64) DEFAULT NULL,
      source VARCHAR(32) DEFAULT 'local',
      PRIMARY KEY (id),
      INDEX idx_products_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await addColumn(p, 'products', 'sku', '`sku` VARCHAR(128) DEFAULT NULL AFTER `id`');
  await addColumn(
    p,
    'products',
    'stock_quantity',
    '`stock_quantity` INT NOT NULL DEFAULT 0 AFTER `price`'
  );
  await addColumn(
    p,
    'products',
    'external_tn_id',
    '`external_tn_id` VARCHAR(64) DEFAULT NULL'
  );
  await addColumn(
    p,
    'products',
    'external_ml_id',
    '`external_ml_id` VARCHAR(64) DEFAULT NULL'
  );
  await addColumn(
    p,
    'products',
    'sync_source',
    "`sync_source` VARCHAR(32) NOT NULL DEFAULT 'manual'"
  );
  await addColumn(p, 'products', 'hub_synced_at', '`hub_synced_at` DATETIME DEFAULT NULL');
  await addColumn(
    p,
    'products',
    'created_at',
    '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'
  );
  await addColumn(
    p,
    'products',
    'updated_at',
    '`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
  );
  await addColumn(
    p,
    'products',
    'variants_json',
    '`variants_json` LONGTEXT DEFAULT NULL'
  );
  await addColumn(
    p,
    'products',
    'images_json',
    '`images_json` LONGTEXT DEFAULT NULL'
  );

  await p.query(
    'CREATE INDEX idx_products_sku ON products (sku)'
  ).catch(() => {
    /* índice duplicado */
  });
  await p.query(
    'CREATE INDEX idx_products_external_ml ON products (external_ml_id)'
  ).catch(() => {
    /* duplicado */
  });
}
