import type { Product } from './types.js';

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

export function mapTiendaNubeProduct(raw: Record<string, unknown>): Product | null {
  if (raw.published === false) return null;

  const id = String(raw.id ?? '');
  if (!id) return null;

  const name = pickLocalized(raw.name);
  if (!name) return null;

  const variants = Array.isArray(raw.variants)
    ? (raw.variants as Record<string, unknown>[])
    : [];
  const firstVariant = variants[0];
  let price = 0;
  if (firstVariant?.price != null) {
    const n = parseFloat(String(firstVariant.price).replace(',', '.'));
    if (!Number.isNaN(n)) price = Math.round(n);
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

  let description =
    pickLocalized(raw.description) ||
    pickLocalized(raw.seo_description) ||
    undefined;
  if (description) {
    description = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return {
    id,
    name,
    price,
    image,
    category,
    description,
    externalId: id,
    source: 'tiendanube',
  };
}
