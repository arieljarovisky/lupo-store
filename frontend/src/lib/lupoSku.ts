/**
 * SKU Lupo 13 dígitos: artículo (7) + talle (3) + color (3).
 * Acepta string o número; si vino como número JSON se pierden ceros a la izquierda → se rellena a 13.
 */
export function parseLupoSku13(sku: string | number | undefined | null): {
  article: string;
  size: string;
  color: string;
} | null {
  let digits = String(sku ?? '').replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 12) {
    digits = digits.padStart(13, '0');
  }
  if (digits.length !== 13) return null;
  return {
    article: digits.slice(0, 7),
    size: digits.slice(7, 10),
    color: digits.slice(10, 13),
  };
}

/** Primeros 7 dígitos (código artículo) desde un SKU 13 dígitos. */
export function articleCode7(sku: string | number | undefined | null): string | null {
  return parseLupoSku13(sku)?.article ?? null;
}

/** Artículo para fila de producto: SKU padre o primera variante con SKU válido. */
export function articleCodeFromProduct(p: {
  sku?: string;
  variants?: Array<{ sku?: string }>;
}): string | null {
  const fromProduct = articleCode7(p.sku);
  if (fromProduct) return fromProduct;
  for (const v of p.variants ?? []) {
    const a = articleCode7(v.sku);
    if (a) return a;
  }
  return null;
}
