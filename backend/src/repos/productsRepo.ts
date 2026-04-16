import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../pool.js';
import type { Product, ProductSyncSource, ProductVariant } from '../types.js';

function parseVariants(raw: unknown): ProductVariant[] | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const list = parsed
      .filter((v): v is Record<string, unknown> => Boolean(v && typeof v === 'object'))
      .map((v) => ({
        id: String(v.id ?? ''),
        name: String(v.name ?? ''),
        price: Number(v.price ?? 0),
        stockQuantity: Number(v.stockQuantity ?? 0),
        sku: v.sku != null ? String(v.sku) : undefined,
      }))
      .filter((v) => v.id && v.name);
    return list.length > 0 ? list : undefined;
  } catch {
    return undefined;
  }
}

function rowToProduct(row: RowDataPacket): Product {
  const sync = String(row.sync_source ?? 'manual');
  const syncSource: ProductSyncSource =
    sync === 'tiendanube' || sync === 'lupo_hub' || sync === 'mercadolibre' || sync === 'manual'
      ? sync
      : 'manual';

  return {
    id: String(row.id),
    sku: row.sku != null ? String(row.sku) : undefined,
    name: String(row.name),
    price: Number(row.price),
    stockQuantity: Number(row.stock_quantity ?? 0),
    image: String(row.image ?? ''),
    category: String(row.category ?? 'General'),
    description: row.description != null ? String(row.description) : undefined,
    externalId: row.external_id != null ? String(row.external_id) : undefined,
    externalTnId: row.external_tn_id != null ? String(row.external_tn_id) : undefined,
    externalMlId: row.external_ml_id != null ? String(row.external_ml_id) : undefined,
    source:
      row.source === 'tiendanube' || row.source === 'local' ? row.source : 'local',
    syncSource,
    hubSyncedAt: row.hub_synced_at
      ? new Date(String(row.hub_synced_at)).toISOString()
      : null,
    variants: parseVariants(row.variants_json),
  };
}

export async function listProducts(): Promise<Product[]> {
  const p = await getPool();
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT id, sku, name, price, stock_quantity, image, category, description,
            external_id, external_tn_id, external_ml_id, source, sync_source, hub_synced_at, variants_json
     FROM products ORDER BY name`
  );
  return rows.map(rowToProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const p = await getPool();
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT id, sku, name, price, stock_quantity, image, category, description,
            external_id, external_tn_id, external_ml_id, source, sync_source, hub_synced_at, variants_json
     FROM products WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) return null;
  return rowToProduct(rows[0]);
}

export async function replaceAllProducts(products: Product[]): Promise<void> {
  const p = await getPool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM products');
    const sql = `INSERT INTO products (
      id, sku, name, price, stock_quantity, image, category, description,
      external_id, external_tn_id, external_ml_id, source, sync_source, hub_synced_at, variants_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    for (const row of products) {
      await conn.query(sql, [
        row.id,
        row.sku ?? null,
        row.name,
        row.price,
        row.stockQuantity ?? 0,
        row.image,
        row.category,
        row.description ?? null,
        row.externalId ?? null,
        row.externalTnId ?? null,
        row.externalMlId ?? null,
        row.source ?? 'local',
        row.syncSource ?? 'manual',
        row.hubSyncedAt ? new Date(row.hubSyncedAt) : null,
        row.variants?.length ? JSON.stringify(row.variants) : null,
      ]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export interface HubProductPayload {
  id: string;
  sku?: string | null;
  name?: string | null;
  price?: number | null;
  stock_quantity: number;
  image?: string | null;
  category?: string | null;
  description?: string | null;
  external_tn_id?: string | null;
  external_ml_id?: string | null;
}

/** Upsert parcial desde Lupo Hub (stock / precio / IDs externos). */
export async function upsertProductsFromHub(items: HubProductPayload[]): Promise<number> {
  if (items.length === 0) return 0;
  const p = await getPool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const sql = `
      INSERT INTO products (
        id, sku, name, price, stock_quantity, image, category, description,
        external_id, external_tn_id, external_ml_id, source, sync_source, hub_synced_at, variants_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'lupo_hub', NOW(), ?)
      ON DUPLICATE KEY UPDATE
        sku = COALESCE(VALUES(sku), sku),
        name = COALESCE(VALUES(name), name),
        price = COALESCE(VALUES(price), price),
        stock_quantity = VALUES(stock_quantity),
        image = COALESCE(VALUES(image), image),
        category = COALESCE(VALUES(category), category),
        description = COALESCE(VALUES(description), description),
        external_tn_id = COALESCE(VALUES(external_tn_id), external_tn_id),
        external_ml_id = COALESCE(VALUES(external_ml_id), external_ml_id),
        variants_json = COALESCE(VALUES(variants_json), variants_json),
        sync_source = 'lupo_hub',
        hub_synced_at = NOW()
    `;
    let n = 0;
    for (const it of items) {
      const [exRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, sku, name, price, stock_quantity, image, category, description,
                external_id, external_tn_id, external_ml_id, source, sync_source, hub_synced_at, variants_json
         FROM products WHERE id = ? LIMIT 1`,
        [it.id]
      );
      const existing = exRows[0] ? rowToProduct(exRows[0]) : null;
      await conn.query(sql, [
        it.id,
        it.sku ?? existing?.sku ?? null,
        it.name ?? existing?.name ?? 'Producto',
        it.price ?? existing?.price ?? 0,
        it.stock_quantity,
        it.image ?? existing?.image ?? '',
        it.category ?? existing?.category ?? 'General',
        it.description ?? existing?.description ?? null,
        existing?.externalId ?? String(it.id),
        it.external_tn_id ?? existing?.externalTnId ?? null,
        it.external_ml_id ?? existing?.externalMlId ?? null,
        existing?.variants?.length ? JSON.stringify(existing.variants) : null,
      ]);
      n += 1;
    }
    await conn.commit();
    return n;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
