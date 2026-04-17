/**
 * SKU Lupo 13 dígitos: artículo (7) + talle (3) + color (3).
 * Ignora separadores no numéricos.
 */
export function parseLupoSku13(sku: string | undefined | null): {
  article: string;
  size: string;
  color: string;
} | null {
  const digits = String(sku ?? '').replace(/\D/g, '');
  if (digits.length !== 13) return null;
  return {
    article: digits.slice(0, 7),
    size: digits.slice(7, 10),
    color: digits.slice(10, 13),
  };
}
