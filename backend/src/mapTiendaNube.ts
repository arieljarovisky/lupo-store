import type { Product, ProductVariant } from './types.js';

interface VariantOptionValueInfo {
  name?: string;
  swatch?: string;
}

interface VariantOptionCatalog {
  optionNamesById: Map<string, string>;
  valuesById: Map<string, VariantOptionValueInfo>;
}

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

function buildOptionCatalog(raw: Record<string, unknown>): VariantOptionCatalog {
  const optionNamesById = new Map<string, string>();
  const valuesById = new Map<string, VariantOptionValueInfo>();

  const optionSources: unknown[] = [];
  for (const key of ['attributes', 'options', 'variants_attributes', 'product_options'] as const) {
    optionSources.push(raw[key]);
  }
  for (const src of optionSources) {
    if (!Array.isArray(src)) continue;
    for (const item of src) {
      if (!item || typeof item !== 'object') continue;
      const opt = item as Record<string, unknown>;
      const optionId = String(opt.id ?? '').trim();
      const optionName = pickLocalized(opt.name) || pickLocalized(opt.label);
      if (optionId && optionName) optionNamesById.set(optionId, optionName);

      const valSource = Array.isArray(opt.values)
        ? opt.values
        : Array.isArray(opt.options)
          ? opt.options
          : [];
      for (const val of valSource) {
        if (!val || typeof val !== 'object') continue;
        const v = val as Record<string, unknown>;
        const valueId = String(v.id ?? v.value_id ?? '').trim();
        if (!valueId) continue;
        const valueName = pickLocalized(v.name) || pickLocalized(v.value) || pickLocalized(v.label);
        const swatch =
          pickLocalized(v.html_color) || pickLocalized(v.color) || pickLocalized(v.rgb) || undefined;
        valuesById.set(valueId, { name: valueName || undefined, swatch });
      }
    }
  }

  return { optionNamesById, valuesById };
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

/** Código de barras / SKU solo dígitos (ej. EAN-13), no sirve como etiqueta visible. */
function looksLikeBarcodeOrNumericSku(s: string): boolean {
  const t = s.trim();
  if (t.length < 8) return false;
  return /^\d+$/.test(t);
}

/**
 * Etiqueta legible para la variante: color/talle u opciones humanas.
 * Evita mostrar el EAN como "nombre" cuando TN lo guarda en `name`.
 */
function buildVariantDisplayName(
  raw: Record<string, unknown>,
  catalog: VariantOptionCatalog,
  variantIndex: number
): string {
  const optionValues = optionValuesFromVariant(raw, catalog);
  const inferred = inferVariantDetails(optionValues);

  const fromInferred: string[] = [];
  if (inferred.colorName) fromInferred.push(inferred.colorName);
  if (inferred.size) fromInferred.push(inferred.size);
  if (fromInferred.length > 0) return fromInferred.join(' · ');

  const humanOptionValues = optionValues
    .map((ov) => ov.value.trim())
    .filter((v) => v && !looksLikeBarcodeOrNumericSku(v));
  if (humanOptionValues.length > 0) return [...new Set(humanOptionValues)].join(' · ');

  const fromVals = valuesFromVariant(raw).filter((p) => !looksLikeBarcodeOrNumericSku(p));
  if (fromVals.length > 0) return fromVals.join(' · ');

  const direct =
    pickLocalized(raw.name) ||
    pickLocalized(raw.variant_name) ||
    pickLocalized(raw.label) ||
    String(raw.sku ?? '').trim();
  if (direct && !looksLikeBarcodeOrNumericSku(direct)) return direct;

  const barcode =
    direct ||
    String(raw.sku ?? '').trim() ||
    pickLocalized(raw.barcode) ||
    pickLocalized(raw.ean) ||
    '';
  if (barcode && looksLikeBarcodeOrNumericSku(barcode)) {
    return `Presentación ${variantIndex + 1} (ref. ${barcode.slice(-6)})`;
  }
  return `Variante ${variantIndex + 1}`;
}

function isLikelySize(value: string): boolean {
  const v = value.trim().toUpperCase();
  if (!v) return false;
  if (
    /^(XXS|XS|S|M|L|XL|XXL|XXXL|XXG|XG|G|EG|GG|XGG|P|PP|CH|RM|RG|2XL|3XL|U|UNI|UNICO|ÚNICO|Única|UNICA)$/.test(v)
  )
    return true;
  if (/^\d{2,3}$/.test(v)) return true;
  if (/^\d+\s*-\s*\d+$/.test(v)) return true;
  return /(TALLE|TALLA|SIZE)/i.test(value);
}

function isColorName(value: string): boolean {
  return /(NEGRO|BLANCO|AZUL(\s+MARINO)?|ROJO|VERDE|GRIS|BEIGE|BORD[OÓ]|ROSA|MARR[OÓ]N|VIOLETA|NARANJA|AMARILLO|CELESTE|BROWN|BLACK|WHITE|BLUE|RED|GREEN|GREY|GRAY|PINK|PURPLE|VIOLET|NAVY)/i.test(
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
    // TN a veces etiqueta mal la opción (ej. "Color" con valor "P" = talle pequeño).
    if (!colorName && !isLikelySize(val) && (name.includes('color') || isColorName(val))) {
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

function optionValuesFromVariant(
  raw: Record<string, unknown>,
  catalog: VariantOptionCatalog
): Array<{ name: string; value: string; swatch?: string }> {
  const out: Array<{ name: string; value: string; swatch?: string }> = [];
  const vals = raw.values;
  if (Array.isArray(vals)) {
    vals.forEach((v, idx) => {
      if (typeof v === 'string') {
        const valueId = v.trim();
        if (!valueId) return;
        const resolved = catalog.valuesById.get(valueId);
        const value = resolved?.name || valueId;
        const optionId = String(raw[`attribute${idx + 1}`] ?? '').trim();
        const name = catalog.optionNamesById.get(optionId) || `Opción ${idx + 1}`;
        out.push({ name, value, swatch: resolved?.swatch });
        return;
      }
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        const valId = String(o.id ?? o.value_id ?? '').trim();
        const resolved = valId ? catalog.valuesById.get(valId) : undefined;
        const name =
          pickLocalized(o.name) ||
          pickLocalized(o.attribute) ||
          catalog.optionNamesById.get(String(o.attribute_id ?? '').trim()) ||
          `Opción ${idx + 1}`;
        const value = pickLocalized(o.value) || pickLocalized(o.label) || resolved?.name || '';
        const swatchRaw =
          pickLocalized(o.html_color) || pickLocalized(o.color) || pickLocalized(o.rgb) || resolved?.swatch;
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
      const key = String(k).trim();
      const resolved = catalog.valuesById.get(key);
      const value = pickLocalized(v) || resolved?.name || key;
      if (value) out.push({ name: k, value, swatch: resolved?.swatch });
    });
  }
  for (const i of [1, 2, 3] as const) {
    const value = pickLocalized(raw[`option${i}`]);
    if (!value) continue;
    const name = pickLocalized(raw[`option${i}_name`]) || `Opción ${i}`;
    out.push({ name, value });
  }

  const props = raw.properties;
  if (Array.isArray(props)) {
    for (const p of props) {
      if (!p || typeof p !== 'object') continue;
      const o = p as Record<string, unknown>;
      const propName =
        pickLocalized(o.name) || pickLocalized(o.property) || pickLocalized(o.key) || 'Propiedad';
      const propValue =
        pickLocalized(o.value) || pickLocalized(o.text) || String(o.val ?? '').trim();
      if (propName.trim() && propValue.trim()) {
        out.push({ name: propName.trim(), value: propValue.trim() });
      }
    }
  }

  return out;
}

/** Stock total: `stock` legacy o suma de `inventory_levels` (multi-inventario). */
function variantStockFromApi(v: Record<string, unknown>): number {
  const raw = v.stock;
  if (raw != null && raw !== '') {
    const n = Number.parseInt(String(raw), 10);
    if (!Number.isNaN(n)) return Math.max(0, n);
  }
  const levels = v.inventory_levels;
  if (Array.isArray(levels)) {
    let sum = 0;
    for (const lvl of levels) {
      if (lvl && typeof lvl === 'object') {
        const s = (lvl as Record<string, unknown>).stock;
        if (s != null) sum += Math.max(0, Number(s) || 0);
      }
    }
    return Math.round(sum);
  }
  return 0;
}

function mapVariants(
  rawVariants: Record<string, unknown>[],
  imagesById: Map<string, string>,
  catalog: VariantOptionCatalog
): ProductVariant[] {
  const mapped: Array<ProductVariant | null> = rawVariants.map((v, variantIndex) => {
      const id = String(v.id ?? '').trim();
      if (!id) return null;
      const priceNum = Number.parseFloat(String(v.price ?? '0').replace(',', '.'));
      const price = Number.isNaN(priceNum) ? 0 : Math.round(priceNum);
      const stockQuantity = variantStockFromApi(v);
      const optionValues = optionValuesFromVariant(v, catalog);
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
        name: buildVariantDisplayName(v, catalog, variantIndex),
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

function chooseProductSku(
  raw: Record<string, unknown>,
  variants: ProductVariant[]
): string | undefined {
  const ownSku = String(raw.sku ?? '').trim();
  if (ownSku) return ownSku;

  const withStock = variants.find((v) => (v.stockQuantity ?? 0) > 0 && v.sku?.trim());
  if (withStock?.sku?.trim()) return withStock.sku.trim();

  const anyVariantSku = variants.find((v) => v.sku?.trim());
  if (anyVariantSku?.sku?.trim()) return anyVariantSku.sku.trim();

  return undefined;
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
  const optionCatalog = buildOptionCatalog(raw);
  const mappedVariants = mapVariants(variants, mappedImages.byId, optionCatalog);
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
  const sku = chooseProductSku(raw, mappedVariants);

  return {
    id,
    sku,
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
