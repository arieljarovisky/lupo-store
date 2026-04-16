import type { Product, ProductVariant } from './types.js';

function pickLocalized(val: unknown): string {
  if (typeof val === 'string') return val.trim();
  if (val && typeof val === 'object') {
    const o = val as Record<string, unknown>;
    const es = o.es;
    const en = o.en;
    const pt = o.pt;
    if (typeof es === 'string') return es.trim();
    if (typeof en === 'string') return en.trim();
    if (typeof pt === 'string') return pt.trim();
    const first = Object.values(o).find((v) => typeof v === 'string');
    if (typeof first === 'string') return first.trim();
  }
  return '';
}

function categoryLabel(cat: Record<string, unknown> | undefined): string {
  if (!cat) return 'General';
  const name = pickLocalized(cat.name);
  return name || 'General';
}

function normalizeDescriptionHtml(input: unknown): string | undefined {
  const html = pickLocalized(input);
  if (!html) return undefined;
  // Conservamos HTML (ej. tabla de talles) y removemos tags peligrosos básicos.
  const cleaned = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\sjavascript:/gi, ' ');
  return cleaned.trim() || undefined;
}

function valuesFromVariant(raw: Record<string, unknown>): string[] {
  const out: string[] = [];
  const vals = raw.values;
  if (Array.isArray(vals)) {
    for (const v of vals) {
      const txt =
        pickLocalized(v) ||
        (v && typeof v === 'object' ? pickLocalized((v as Record<string, unknown>).value) : '');
      if (txt) out.push(txt.trim());
    }
  } else if (vals && typeof vals === 'object') {
    for (const v of Object.values(vals as Record<string, unknown>)) {
      const txt = pickLocalized(v);
      if (txt) out.push(txt.trim());
    }
  }
  for (const key of ['option1', 'option2', 'option3'] as const) {
    const txt = pickLocalized(raw[key]);
    if (txt) out.push(txt.trim());
  }
  return [...new Set(out.filter(Boolean))];
}

function variantLabel(raw: Record<string, unknown>): string {
  const direct =
    pickLocalized(raw.name) ||
    pickLocalized(raw.variant_name) ||
    pickLocalized(raw.label) ||
    String(raw.sku ?? '').trim();
  if (direct) return direct;
  const parts = valuesFromVariant(raw);
  if (parts.length > 0) return parts.join(' / ');
  return 'Variante';
}

function mapVariants(rawVariants: Record<string, unknown>[]): ProductVariant[] {
  const mapped: Array<ProductVariant | null> = rawVariants.map((v) => {
      const id = String(v.id ?? '').trim();
      if (!id) return null;
      const priceNum = Number.parseFloat(String(v.price ?? '0').replace(',', '.'));
      const stockNum = Number.parseInt(String(v.stock ?? '0'), 10);
      const price = Number.isNaN(priceNum) ? 0 : Math.round(priceNum);
      const stockQuantity = Number.isNaN(stockNum) ? 0 : Math.max(0, stockNum);
      const item: ProductVariant = {
        id,
        name: variantLabel(v),
        price,
        stockQuantity,
        sku: v.sku != null ? String(v.sku).trim() || undefined : undefined,
      };
      return item;
    });
  return mapped.filter((v): v is ProductVariant => v !== null);
}

export function mapTiendaNubeProduct(raw: Record<string, unknown>): Product | null {
  if (raw.published === false) return null;

  const id = String(raw.id ?? '');
  if (!id) return null;

  const name = pickLocalized(raw.name);
  if (!name) return null;

  const variants = Array.isArray(raw.variants)
    ? (raw.variants as Record<string, unknown>[])
    : [];
  const mappedVariants = mapVariants(variants);
  const firstVariant = mappedVariants[0];
  let price = 0;
  if (firstVariant?.price != null) price = firstVariant.price;

  let stockQuantity = 0;
  if (mappedVariants.length > 0) {
    stockQuantity = mappedVariants.reduce((acc, it) => acc + Math.max(0, it.stockQuantity), 0);
  }

  const images = Array.isArray(raw.images) ? (raw.images as Record<string, unknown>[]) : [];
  let image = '';
  if (images[0]) {
    const first = images[0];
    const src = first.src;
    if (typeof src === 'string') image = src;
    else if (src && typeof src === 'object') image = pickLocalized(src);
    if (!image && first.image != null) {
      const im = first.image;
      image = typeof im === 'string' ? im : pickLocalized(im);
    }
  }

  const categories = Array.isArray(raw.categories)
    ? (raw.categories as Record<string, unknown>[])
    : [];
  const category = categoryLabel(categories[0]);

  const description =
    normalizeDescriptionHtml(raw.description) ?? normalizeDescriptionHtml(raw.seo_description);

  return {
    id,
    name,
    price,
    stockQuantity,
    image,
    category,
    description,
    variants: mappedVariants.length > 0 ? mappedVariants : undefined,
    externalId: id,
    externalTnId: id,
    source: 'tiendanube',
    syncSource: 'tiendanube',
  };
}
