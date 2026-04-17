import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../pool.js';
import type { Product, ProductSyncSource, ProductVariant } from '../types.js';

function parseStringArray(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const list = parsed.map((x) => String(x ?? '').trim()).filter(Boolean);
    return list.length > 0 ? list : undefined;
  } catch {
    return undefined;
  }
}

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
        size: v.size != null ? String(v.size) : undefined,
        colorName: v.colorName != null ? String(v.colorName) : undefined,
        colorHex: v.colorHex != null ? String(v.colorHex) : undefined,
        image: v.image != null ? String(v.image) : undefined,
        optionValues: Array.isArray(v.optionValues)
          ? (v.optionValues as Array<Record<string, unknown>>)
              .map((it) => ({
                name: String(it.name ?? '').trim(),
                value: String(it.value ?? '').trim(),
                swatch: it.swatch != null ? String(it.swatch).trim() : undefined,
              }))
              .filter((it) => it.name && it.value)
          : undefined,
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
    images: parseStringArray(row.images_json),
  };
}

export async function listProducts(): Promise<Product[]> {
  const p = await getPool();
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT id, sku, name, price, stock_quantity, image, category, description,
            external_id, external_tn_id, external_ml_id, source, sync_source, hub_synced_at, variants_json, images_json
     FROM products ORDER BY name`
  );
  return rows.map(rowToProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const p = await getPool();
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT id, sku, name, price, stock_quantity, image, category, description,
            external_id, external_tn_id, external_ml_id, source, sync_source, hub_synced_at, variants_json, images_json
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
      external_id, external_tn_id, external_ml_id, source, sync_source, hub_synced_at, variants_json, images_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
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
        row.images?.length ? JSON.stringify(row.images) : null,
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

export interface HubStockWebhookPayloadItem {
  id?: string | null;
  sku?: string | null;
  external_tn_id?: string | null;
  external_ml_id?: string | null;
  variant_id?: string | null;
  variant_sku?: string | null;
  stock_quantity: number;
}

export interface HubStockWebhookResult {
  received: number;
  updated: number;
  variantUpdated: number;
  invalid: Array<{ index: number; reason: string }>;
  notFound: Array<{ index: number; ref: string }>;
}

function nonEmptyString(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s || null;
}

function safeNonNegativeStock(v: unknown): number | null {
  if (typeof v !== 'number' || Number.isNaN(v) || !Number.isFinite(v)) return null;
  return Math.max(0, Math.round(v));
}

/**
 * Orden pensado para ERP + Tienda Nube:
 * 1) external_tn_id — ID de producto en TN (columna homónima; en import suele coincidir con `id`)
 * 2) id — mismo ID que `products.id` (TN guarda el id de producto aquí)
 * 3) sku — SKU a nivel producto (fallback)
 * 4) external_ml_id
 */
function webhookProductLookupAttempts(
  it: HubStockWebhookPayloadItem
): Array<{ sql: string; params: unknown[]; ref: string }> {
  const out: Array<{ sql: string; params: unknown[]; ref: string }> = [];
  const byTn = nonEmptyString(it.external_tn_id);
  if (byTn) out.push({ sql: 'external_tn_id = ?', params: [byTn], ref: `external_tn_id:${byTn}` });
  const byId = nonEmptyString(it.id);
  if (byId) out.push({ sql: 'id = ?', params: [byId], ref: `id:${byId}` });
  const bySku = nonEmptyString(it.sku);
  if (bySku) out.push({ sql: 'sku = ?', params: [bySku], ref: `sku:${bySku}` });
  const byMl = nonEmptyString(it.external_ml_id);
  if (byMl) out.push({ sql: 'external_ml_id = ?', params: [byMl], ref: `external_ml_id:${byMl}` });
  return out;
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
        external_id, external_tn_id, external_ml_id, source, sync_source, hub_synced_at, variants_json, images_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'lupo_hub', NOW(), ?, ?)
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
        images_json = COALESCE(VALUES(images_json), images_json),
        sync_source = 'lupo_hub',
        hub_synced_at = NOW()
    `;
    let n = 0;
    for (const it of items) {
      const [exRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, sku, name, price, stock_quantity, image, category, description,
                external_id, external_tn_id, external_ml_id, source, sync_source, hub_synced_at, variants_json, images_json
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
        existing?.images?.length ? JSON.stringify(existing.images) : null,
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

/**
 * Webhook de stock desde ERP/Lupo Hub.
 * Producto: external_tn_id → id → sku → external_ml_id (primer match).
 * Variante: variant_id / variant_sku; si no van, el `sku` del ítem se interpreta como
 * SKU de variante cuando hay variants_json y coincide con alguna variante (típico: TN id + SKU artículo).
 */
export async function applyStockWebhookFromHub(
  items: HubStockWebhookPayloadItem[]
): Promise<HubStockWebhookResult> {
  const result: HubStockWebhookResult = {
    received: items.length,
    updated: 0,
    variantUpdated: 0,
    invalid: [],
    notFound: [],
  };
  if (items.length === 0) return result;

  const p = await getPool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();

    for (let index = 0; index < items.length; index += 1) {
      const it = items[index];
      const targetStock = safeNonNegativeStock(it.stock_quantity);
      if (targetStock === null) {
        result.invalid.push({ index, reason: 'stock_quantity debe ser un número válido.' });
        continue;
      }

      const attempts = webhookProductLookupAttempts(it);
      if (attempts.length === 0) {
        result.invalid.push({
          index,
          reason: 'Falta identificador. Enviá id, sku, external_tn_id o external_ml_id.',
        });
        continue;
      }

      let rows: RowDataPacket[] = [];
      for (const lookup of attempts) {
        const [r] = await conn.query<RowDataPacket[]>(
          `SELECT id, sku, name, price, stock_quantity, image, category, description,
                  external_id, external_tn_id, external_ml_id, source, sync_source, hub_synced_at, variants_json, images_json
           FROM products
           WHERE ${lookup.sql}
           LIMIT 1`,
          lookup.params
        );
        if (r.length) {
          rows = r;
          break;
        }
      }
      if (!rows.length) {
        result.notFound.push({
          index,
          ref: attempts.map((a) => a.ref).join(' | '),
        });
        continue;
      }

      const current = rowToProduct(rows[0]);
      const explicitVariantId = nonEmptyString(it.variant_id);
      const explicitVariantSku = nonEmptyString(it.variant_sku);
      const payloadSku = nonEmptyString(it.sku);
      const hadExplicitVariantHint = Boolean(explicitVariantId || explicitVariantSku);

      let nextVariants = current.variants;
      let nextProductStock = targetStock;
      let touchedVariant = false;

      if (current.variants?.length) {
        nextVariants = current.variants.map((v) => ({ ...v }));
        let match = nextVariants.find(
          (v) =>
            (explicitVariantId && v.id === explicitVariantId) ||
            (explicitVariantSku && nonEmptyString(v.sku) === explicitVariantSku)
        );
        if (!match && payloadSku) {
          match = nextVariants.find((v) => nonEmptyString(v.sku) === payloadSku);
        }
        if (match) {
          match.stockQuantity = targetStock;
          nextProductStock = nextVariants.reduce(
            (sum, v) => sum + Math.max(0, Number(v.stockQuantity) || 0),
            0
          );
          touchedVariant = true;
          result.variantUpdated += 1;
        }
      }

      await conn.query(
        `UPDATE products
         SET stock_quantity = ?, variants_json = ?, sync_source = 'lupo_hub', hub_synced_at = NOW()
         WHERE id = ?`,
        [
          nextProductStock,
          nextVariants?.length ? JSON.stringify(nextVariants) : null,
          current.id,
        ]
      );
      result.updated += 1;

      if (hadExplicitVariantHint && current.variants?.length && !touchedVariant) {
        result.invalid.push({
          index,
          reason: 'No se encontró la variante (variant_id / variant_sku). El stock del producto se dejó como valor enviado.',
        });
      }
    }

    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
