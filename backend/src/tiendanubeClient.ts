const DEFAULT_VERSION = '2025-03';

function apiBase(version: string): string {
  return `https://api.tiendanube.com/${version}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface TiendaNubeFetchOptions {
  storeId: string;
  accessToken: string;
  userAgent: string;
  /** Ej. 2025-03 (ver documentación oficial) */
  apiVersion?: string;
  /** Pausa entre páginas (ms) para respetar límites de la API */
  pageDelayMs?: number;
  /** Pausa entre GET /products/{id}/variants (por defecto 300 ms) */
  variantFetchDelayMs?: number;
  perPage?: number;
}

export async function fetchAllProductsFromTiendaNube(
  opts: TiendaNubeFetchOptions
): Promise<Record<string, unknown>[]> {
  const { storeId, accessToken, userAgent } = opts;
  const version = opts.apiVersion ?? DEFAULT_VERSION;
  const perPage = opts.perPage ?? 50;
  const pageDelayMs = opts.pageDelayMs ?? 600;

  const headers: Record<string, string> = {
    Authentication: `bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'User-Agent': userAgent,
  };

  const all: Record<string, unknown>[] = [];
  let page = 1;

  for (;;) {
    const url = new URL(`${apiBase(version)}/${storeId}/products`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(perPage));

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Tienda Nube API ${res.status}: ${text.slice(0, 500)}`);
    }

    const batch = (await res.json()) as unknown;
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const item of batch) {
      if (item && typeof item === 'object') {
        all.push(item as Record<string, unknown>);
      }
    }

    if (batch.length < perPage) break;
    page += 1;
    await sleep(pageDelayMs);
  }

  await enrichProductsWithVariantsFromEndpoint(opts, all);

  return all;
}

/**
 * El listado GET /products a veces trae pocas variantes; el endpoint dedicado devuelve todas.
 * Ver: GET /products/{product_id}/variants
 */
async function enrichProductsWithVariantsFromEndpoint(
  opts: TiendaNubeFetchOptions,
  products: Record<string, unknown>[]
): Promise<void> {
  const { storeId, accessToken, userAgent } = opts;
  const version = opts.apiVersion ?? DEFAULT_VERSION;
  const delayMs = opts.variantFetchDelayMs ?? 300;

  const headers: Record<string, string> = {
    Authentication: `bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'User-Agent': userAgent,
  };

  for (const p of products) {
    const id = String(p.id ?? '').trim();
    if (!id) continue;

    const url = `${apiBase(version)}/${storeId}/products/${id}/variants`;
    const res = await fetch(url, { headers });
    if (!res.ok) continue;

    const batch = (await res.json()) as unknown;
    if (Array.isArray(batch) && batch.length > 0) {
      p.variants = batch as Record<string, unknown>[];
    }
    await sleep(delayMs);
  }
}
