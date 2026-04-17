/**
 * SKU Lupo tipo EAN-13: artículo (7) + talle (3) + color (3).
 * Si el JSON envía el SKU como número, se pierden ceros a la izquierda; se rellenan a 13 dígitos.
 */
export function digitsOnly(s: unknown): string {
  return String(s ?? '').replace(/\D/g, '');
}

/** Valor para `WHERE sku = ?`: dígitos 10–12 → pad a 13; 13 dígitos tal cual; si no, string original. */
export function skuForDbQuery(s: unknown): string | null {
  const raw = String(s ?? '').trim();
  if (!raw) return null;
  const d = digitsOnly(s);
  if (d.length >= 10 && d.length <= 12) return d.padStart(13, '0');
  if (d.length === 13) return d;
  return raw;
}

/** Misma clave lógica aunque un lado venga como número sin ceros iniciales. */
export function skuComparable(a: unknown, b: unknown): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  const na = da.length >= 10 && da.length <= 12 ? da.padStart(13, '0') : da;
  const nb = db.length >= 10 && db.length <= 12 ? db.padStart(13, '0') : db;
  if (na.length === 13 && nb.length === 13) return na === nb;
  return da === db;
}
