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
