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

function normalizeDescription(input: unknown): string | undefined {
  const html = pickLocalized(input);
  if (!html) return undefined;
  const withBreaks = html
    .replace(/<(br|BR)\s*\/?>/g, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, '\n');
  const clean = withBreaks
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return clean || undefined;
}

function variantLabel(raw: Record<string, unknown>): string {
  const direct =
    pickLocalized(raw.name) ||
    pickLocalized(raw.variant_name) ||
    pickLocalized(raw.label) ||
    String(raw.sku ?? '').trim();
  if (direct) return direct;

  const values = Array.isArray(raw.values) ? (raw.values as unknown[]) : [];
  const parts = values
    .map((v) => pickLocalized(v))
    .map((v) => v.trim())
    .filter(Boolean);
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

  const description = normalizeDescription(raw.description) ?? normalizeDescription(raw.seo_description);

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
