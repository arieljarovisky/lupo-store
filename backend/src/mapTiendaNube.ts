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

function isLikelySize(value: string): boolean {
  const v = value.trim().toUpperCase();
  if (!v) return false;
  if (/^(XXS|XS|S|M|L|XL|XXL|XXXL)$/.test(v)) return true;
  if (/^\d{2,3}$/.test(v)) return true;
  if (/^\d+\s*-\s*\d+$/.test(v)) return true;
  return /(TALLE|TALLA|SIZE)/i.test(value);
}

function isColorName(value: string): boolean {
  return /(NEGRO|BLANCO|AZUL|ROJO|VERDE|GRIS|BEIGE|BORDO|ROSA|MARRON|BROWN|BLACK|WHITE|BLUE|RED|GREEN|GREY|GRAY|PINK|BEIGE|PURPLE|VIOLET)/i.test(
    value
  );
}

function normalizeColorHex(value: string): string | undefined {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(v) || /^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^rgb(a?)\(/i.test(v)) return v;
  return undefined;
}

function inferVariantDetails(optionValues: Array<{ name: string; value: string; swatch?: string }>): {
  size?: string;
  colorName?: string;
  colorHex?: string;
} {
  let size: string | undefined;
  let colorName: string | undefined;
  let colorHex: string | undefined;

  for (const ov of optionValues) {
    const name = ov.name.toLowerCase();
    const val = ov.value.trim();
    const sw = ov.swatch?.trim();

    if (!size && (name.includes('talle') || name.includes('talla') || name.includes('size') || isLikelySize(val))) {
      size = val;
    }

    const hexFromVal = normalizeColorHex(val);
    const hexFromSw = sw ? normalizeColorHex(sw) : undefined;
    if (!colorHex && (hexFromVal || hexFromSw)) {
      colorHex = hexFromVal || hexFromSw;
    }
    if (!colorName && (name.includes('color') || isColorName(val))) {
      colorName = val;
    }
  }

  if (!size) {
    const any = optionValues.map((x) => x.value).find(isLikelySize);
    if (any) size = any;
  }
  if (!colorName) {
    const anyColor = optionValues.map((x) => x.value).find(isColorName);
    if (anyColor) colorName = anyColor;
  }
  return { size, colorName, colorHex };
}

function imageUrlFromNode(node: Record<string, unknown>): string {
  const src = node.src;
  if (typeof src === 'string' && src.trim()) return src.trim();
  if (src && typeof src === 'object') {
    const p = pickLocalized(src);
    if (p) return p;
  }
  if (node.image != null) {
    const im = node.image;
    if (typeof im === 'string' && im.trim()) return im.trim();
    if (im && typeof im === 'object') {
      const p = pickLocalized(im);
      if (p) return p;
    }
  }
  return '';
}

function mapProductImages(rawImages: Record<string, unknown>[]): {
  urls: string[];
  byId: Map<string, string>;
} {
  const urls: string[] = [];
  const byId = new Map<string, string>();
  for (const img of rawImages) {
    const url = imageUrlFromNode(img);
    if (!url) continue;
    urls.push(url);
    const id = String(img.id ?? '').trim();
    if (id) byId.set(id, url);
  }
  return { urls: [...new Set(urls)], byId };
}

function optionValuesFromVariant(raw: Record<string, unknown>): Array<{ name: string; value: string; swatch?: string }> {
  const out: Array<{ name: string; value: string; swatch?: string }> = [];
  const vals = raw.values;
  if (Array.isArray(vals)) {
    vals.forEach((v, idx) => {
      if (typeof v === 'string') {
        const value = v.trim();
        if (value) out.push({ name: `Opción ${idx + 1}`, value });
        return;
      }
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        const name = pickLocalized(o.name) || pickLocalized(o.attribute) || `Opción ${idx + 1}`;
        const value = pickLocalized(o.value) || pickLocalized(o.label) || '';
        const swatchRaw =
          pickLocalized(o.html_color) || pickLocalized(o.color) || pickLocalized(o.rgb);
        if (name.trim() && value.trim()) {
          out.push({
            name: name.trim(),
            value: value.trim(),
            swatch: swatchRaw || undefined,
          });
        }
      }
    });
  } else if (vals && typeof vals === 'object') {
    Object.entries(vals as Record<string, unknown>).forEach(([k, v]) => {
      const value = pickLocalized(v);
      if (value) out.push({ name: k, value });
    });
  }
  for (const i of [1, 2, 3] as const) {
    const value = pickLocalized(raw[`option${i}`]);
    if (!value) continue;
    const name = pickLocalized(raw[`option${i}_name`]) || `Opción ${i}`;
    out.push({ name, value });
  }
  return out;
}

function mapVariants(rawVariants: Record<string, unknown>[], imagesById: Map<string, string>): ProductVariant[] {
  const mapped: Array<ProductVariant | null> = rawVariants.map((v) => {
      const id = String(v.id ?? '').trim();
      if (!id) return null;
      const priceNum = Number.parseFloat(String(v.price ?? '0').replace(',', '.'));
      const stockNum = Number.parseInt(String(v.stock ?? '0'), 10);
      const price = Number.isNaN(priceNum) ? 0 : Math.round(priceNum);
      const stockQuantity = Number.isNaN(stockNum) ? 0 : Math.max(0, stockNum);
      const optionValues = optionValuesFromVariant(v);
      const inferred = inferVariantDetails(optionValues);
      const imageId = String(v.image_id ?? v.imageId ?? '').trim();
      const imageFromId = imageId ? imagesById.get(imageId) : undefined;
      const directImage =
        pickLocalized(v.image_url) ||
        pickLocalized(v.image) ||
        pickLocalized(v.thumbnail) ||
        undefined;
      const item: ProductVariant = {
        id,
        name: variantLabel(v),
        price,
        stockQuantity,
        sku: v.sku != null ? String(v.sku).trim() || undefined : undefined,
        size: inferred.size,
        colorName: inferred.colorName,
        colorHex: inferred.colorHex,
        image: imageFromId || directImage,
        optionValues: optionValues.length > 0 ? optionValues : undefined,
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

  const variants = Array.isArray(raw.variants) ? (raw.variants as Record<string, unknown>[]) : [];
  const images = Array.isArray(raw.images) ? (raw.images as Record<string, unknown>[]) : [];
  const mappedImages = mapProductImages(images);
  const mappedVariants = mapVariants(variants, mappedImages.byId);
  const firstVariant = mappedVariants[0];
  let price = 0;
  if (firstVariant?.price != null) price = firstVariant.price;

  let stockQuantity = 0;
  if (mappedVariants.length > 0) {
    stockQuantity = mappedVariants.reduce((acc, it) => acc + Math.max(0, it.stockQuantity), 0);
  }

  let image = '';
  image = mappedImages.urls[0] || firstVariant?.image || '';

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
    images: mappedImages.urls.length > 0 ? mappedImages.urls : undefined,
    externalId: id,
    externalTnId: id,
    source: 'tiendanube',
    syncSource: 'tiendanube',
  };
}
