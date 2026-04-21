import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useProductCatalog } from '../context/ProductCatalogContext';
import type { Product } from '../context/CartContext';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Tienda Nube / editores a veces guardan `&nbsp` o `&nbsp;` como texto plano.
 * Si luego escapamos `&` a `&amp;`, el usuario ve literal "&nbsp" en pantalla.
 * Normalizamos a espacio real antes de escapar o parsear HTML.
 */
function normalizeDescriptionSource(raw: string): string {
  return raw
    .replace(/&amp;nbsp;?/gi, ' ')
    .replace(/&nbsp;?/gi, ' ')
    .replace(/&#160;|&#x0*A0;/gi, ' ')
    .replace(/\u00a0/g, ' ');
}

function sanitizeDescriptionHtml(raw: string): string {
  if (typeof window === 'undefined') return raw;
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'text/html');
  const blocked = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'];
  for (const tag of blocked) {
    doc.querySelectorAll(tag).forEach((n) => n.remove());
  }
  const allowed = new Set([
    'p',
    'br',
    'strong',
    'em',
    'b',
    'i',
    'u',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'span',
    'div',
  ]);
  const all = Array.from(doc.body.querySelectorAll('*'));
  for (const el of all) {
    const tag = el.tagName.toLowerCase();
    if (!allowed.has(tag)) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const n = attr.name.toLowerCase();
      const v = attr.value.toLowerCase();
      if (n.startsWith('on') || n === 'srcdoc' || v.includes('javascript:')) {
        el.removeAttribute(attr.name);
      }
      if (n === 'style') {
        el.removeAttribute('style');
      }
    }
  }
  return doc.body.innerHTML;
}

function uniqStrings(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const n = String(v ?? '').trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function normalizeColorHex(value?: string): string | undefined {
  const v = String(value ?? '').trim();
  if (!v) return undefined;
  if (/^#[0-9a-fA-F]{3}$/.test(v) || /^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^rgb(a?)\(/i.test(v)) return v;
  return undefined;
}

type ProductVariant = NonNullable<Product['variants']>[number];
type VariantColor = NonNullable<ReturnType<typeof variantColor>>;

function normalizeToken(value?: string): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isLikelySize(value?: string): boolean {
  const v = normalizeToken(value);
  if (!v) return false;
  // P / PP = pequeño (muy usado en ropa interior Lupo); CH = chico; 2XL/3XL
  return (
    /^(xxs|xs|s|m|l|xl|xxl|xxxl|xxg|xg|g|eg|gg|xgg|p|pp|ch|rm|rg|2xl|3xl|u|uni|unico|unica)$/.test(v) ||
    /^\d{2,3}$/.test(v)
  );
}

function isLikelySku(value?: string): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  if (/\s/.test(raw)) return false;
  if (/^\d+$/.test(raw)) return true;
  return /^[A-Za-z0-9._-]{5,}$/.test(raw);
}

/** Parte el texto de variante (TN suele usar "GG · Negro" o "M / Blanco"). */
function splitVariantLabelParts(raw: string): string[] {
  return raw
    .split(/\s*[|/,\-·•]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractColorFromVariantName(variant: ProductVariant): string | undefined {
  const raw = variant.name?.trim();
  if (!raw) return undefined;

  const tokens = splitVariantLabelParts(raw);

  const candidates = tokens.filter((token) => !isLikelySize(token) && !isLikelySku(token));
  if (candidates.length > 0) return candidates[candidates.length - 1];

  if (!isLikelySku(raw) && !isLikelySize(raw)) return raw;
  return undefined;
}

function extractSizeFromVariantName(variant: ProductVariant): string | undefined {
  const raw = variant.name?.trim();
  if (!raw) return undefined;
  const tokens = splitVariantLabelParts(raw);
  return tokens.find((t) => isLikelySize(t));
}

/** Si el color viene como "GG · Negro", deja solo la parte de color para UI y claves. */
function colorNameWithoutSizeTokens(full: string): string {
  const t = full.trim();
  if (!t) return t;
  const parts = splitVariantLabelParts(t);
  if (parts.length <= 1) return t;
  const nonSizes = parts.filter((p) => !isLikelySize(p));
  return nonSizes.length > 0 ? nonSizes.join(' · ') : t;
}

/**
 * Nombre de color (ES/EN) → hex aproximado para swatches cuando TN no manda RGB.
 * Las claves van sin acentos (se comparan con normalizeToken). Orden de búsqueda: más largas primero.
 */
const COLOR_NAME_TO_HEX: Record<string, string> = {
  'azul marino': '#1e3a5f',
  'azul francia': '#2b4c7e',
  'azul petroleo': '#1b4d4d',
  'verde agua': '#7eb6a2',
  'verde militar': '#4b5320',
  'verde manzana': '#7cb518',
  'rosa viejo': '#c4a4a4',
  'rosa chicle': '#ff69b4',
  'gris melange': '#9ca3a8',
  'gris perla': '#c5c5c5',
  'gris topo': '#6d6d6d',
  'gris oscuro': '#4a4a4a',
  'gris claro': '#d3d3d3',
  'marron chocolate': '#5c3d2e',
  'marron suela': '#8b6914',
  burdeos: '#6e1b2f',
  burgundy: '#722f37',
  bordo: '#722f37',
  granate: '#6b2d3c',
  vino: '#5c1f2e',
  ciruela: '#5c3d4d',
  coral: '#ff7f50',
  salmon: '#fa8072',
  durazno: '#ffd4a8',
  mostaza: '#d4a017',
  ocre: '#c8a055',
  natural: '#e8dcc8',
  crudo: '#f2ebe0',
  hueso: '#e8e4d9',
  offwhite: '#f7f7f2',
  celeste: '#87ceeb',
  turquesa: '#40e0d0',
  petroleo: '#1b4d4d',
  violeta: '#7b68a6',
  lila: '#c8a2c8',
  fucsia: '#d946a3',
  magenta: '#c71585',
  lavanda: '#e6e6fa',
  negro: '#111111',
  black: '#111111',
  blanco: '#f5f5f5',
  white: '#f5f5f5',
  blancoroto: '#f0f0f0',
  azul: '#355c8c',
  blue: '#355c8c',
  rojo: '#a42d2d',
  red: '#a42d2d',
  verde: '#4c7a52',
  green: '#4c7a52',
  gris: '#8b8b8b',
  gray: '#8b8b8b',
  grey: '#8b8b8b',
  beige: '#d9c4a3',
  marron: '#8a5a34',
  brown: '#8a5a34',
  rosa: '#e8b4b4',
  pink: '#e8b4b4',
  naranja: '#e07020',
  orange: '#e07020',
  amarillo: '#e6c200',
  yellow: '#e6c200',
  dorado: '#c9a227',
  plateado: '#a8a8a8',
  cobre: '#b87333',
};

/** Claves ordenadas: frases largas antes que palabras cortas (evita que "azul" gane a "azul marino"). */
const COLOR_NAME_KEYS_SORTED = Object.keys(COLOR_NAME_TO_HEX).sort((a, b) => b.length - a.length);

function inferColorHex(name?: string): string | undefined {
  const n = normalizeToken(name);
  if (!n) return undefined;

  if (COLOR_NAME_TO_HEX[n]) return COLOR_NAME_TO_HEX[n];

  for (const key of COLOR_NAME_KEYS_SORTED) {
    const nk = normalizeToken(key);
    if (nk && n.includes(nk)) return COLOR_NAME_TO_HEX[key];
  }
  return undefined;
}

function inferCompositeColorHexes(name?: string): string[] {
  const n = normalizeToken(name);
  if (!n) return [];

  const parts = n
    .split(/\s*(?:y|e|\/|\\|\+|&|,| con )\s*/gi)
    .map((x) => x.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const part of parts) {
    const hex = inferColorHex(part);
    if (hex && !out.includes(hex)) out.push(hex);
  }

  if (out.length === 0) {
    const single = inferColorHex(n);
    if (single) out.push(single);
  }

  return out.slice(0, 4);
}

function inferColorSwatch(name?: string): { hex?: string; swatchCss?: string } {
  const palette = inferCompositeColorHexes(name);
  if (palette.length === 0) return {};
  if (palette.length === 1) return { hex: palette[0] };

  const size = 100 / palette.length;
  const stops = palette
    .map((hex, i) => `${hex} ${(i * size).toFixed(2)}% ${((i + 1) * size).toFixed(2)}%`)
    .join(', ');
  return {
    hex: palette[0],
    swatchCss: `linear-gradient(90deg, ${stops})`,
  };
}

function variantSize(variant: ProductVariant): string | undefined {
  if (variant.size?.trim()) return variant.size.trim();
  const byOption = variant.optionValues?.find((ov) =>
    /(talle|talla|size)/i.test(ov.name) ||
    /^(XXS|XS|S|M|L|XL|XXL|XXXL|XXG|XG|G|EG|GG|XGG|P|PP|CH|2XL|3XL|\d{2,3})$/i.test(ov.value.trim())
  );
  return byOption?.value?.trim() || undefined;
}

function variantColor(variant: ProductVariant): { key: string; name: string; hex?: string; swatchCss?: string } | null {
  const inferredFromName = extractColorFromVariantName(variant);
  const colorField = variant.colorName?.trim();
  const colorFieldOk = colorField && !isLikelySize(colorField) ? colorField : undefined;

  const nameByOption = variant.optionValues?.find((ov) => {
    const val = ov.value?.trim() || '';
    if (!val || isLikelySize(val)) return false;
    if (/color/i.test(ov.name)) return true;
    return /(negro|blanco|azul|rojo|verde|gris|beige|marr[oó]n|brown|black|white|blue|red|green|gray|grey|pink)/i.test(
      val
    );
  });
  const optionValOk = nameByOption?.value?.trim();

  const explicitName = (colorFieldOk || optionValOk || inferredFromName || '').trim();
  const colorOnly = explicitName ? colorNameWithoutSizeTokens(explicitName) : '';
  const namePart = colorOnly && !isLikelySize(colorOnly) ? colorOnly : '';

  const inferredSwatch = inferColorSwatch(namePart || explicitName);
  const explicitHex =
    normalizeColorHex(variant.colorHex) ||
    normalizeColorHex(nameByOption?.swatch) ||
    inferredSwatch.hex;

  if (!namePart && !explicitHex) return null;
  const name = namePart || 'Color';
  return {
    key: normalizeToken(namePart || explicitHex || name),
    name,
    hex: explicitHex,
    swatchCss: inferredSwatch.swatchCss,
  };
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { products, loading, error } = useProductCatalog();
  const { addToCart } = useCart();

  const productId = decodeURIComponent(id ?? '');
  const product = products.find((p) => p.id === productId);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColorKey, setSelectedColorKey] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const variantRows = useMemo(() => {
    if (!product?.variants?.length) return [];
    return product.variants.map((variant) => ({
      variant,
      size: variantSize(variant) ?? extractSizeFromVariantName(variant) ?? null,
      color: variantColor(variant),
    }));
  }, [product?.variants]);

  const sizeOptions = useMemo(
    () => uniqStrings(variantRows.map((r) => r.size)),
    [variantRows]
  );

  const colorOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ key: string; name: string; hex?: string; swatchCss?: string }> = [];
    for (const row of variantRows) {
      if (!row.color) continue;
      if (seen.has(row.color.key)) continue;
      seen.add(row.color.key);
      out.push(row.color);
    }
    return out;
  }, [variantRows]);

  const hasStructuredOptions = sizeOptions.length > 0 || colorOptions.length > 0;

  const colorsBySize = useMemo(() => {
    const map = new Map<string, VariantColor[]>();
    for (const row of variantRows) {
      if (!row.size || !row.color) continue;
      if (!map.has(row.size)) map.set(row.size, []);
      const list = map.get(row.size)!;
      if (!list.some((item) => item.key === row.color!.key)) {
        list.push(row.color);
      }
    }
    return map;
  }, [variantRows]);

  const sizesByColor = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of variantRows) {
      if (!row.size || !row.color) continue;
      if (!map.has(row.color.key)) map.set(row.color.key, []);
      const list = map.get(row.color.key)!;
      if (!list.includes(row.size)) {
        list.push(row.size);
      }
    }
    return map;
  }, [variantRows]);

  useEffect(() => {
    if (!product?.variants?.length) {
      setSelectedVariantId(null);
      setSelectedSize(null);
      setSelectedColorKey(null);
      return;
    }
    const first = variantRows[0];
    setSelectedVariantId(first?.variant.id ?? product.variants[0].id);
    setSelectedSize(first?.size ?? null);
    setSelectedColorKey(first?.color?.key ?? null);
  }, [productId, product?.variants, variantRows]);

  const selectedVariant = useMemo(() => {
    if (!variantRows.length) return null;
    if (hasStructuredOptions) {
      const exact = variantRows.find((row) => {
        const okSize = selectedSize ? row.size === selectedSize : true;
        const okColor = selectedColorKey ? row.color?.key === selectedColorKey : true;
        return okSize && okColor;
      });
      if (exact) return exact.variant;

      if (selectedSize) {
        const bySize = variantRows.find((row) => row.size === selectedSize);
        if (bySize) return bySize.variant;
      }
      if (selectedColorKey) {
        const byColor = variantRows.find((row) => row.color?.key === selectedColorKey);
        if (byColor) return byColor.variant;
      }
      return variantRows[0].variant;
    }
    const byId = selectedVariantId
      ? variantRows.find((row) => row.variant.id === selectedVariantId)?.variant
      : null;
    return byId ?? variantRows[0].variant;
  }, [hasStructuredOptions, selectedColorKey, selectedSize, selectedVariantId, variantRows]);

  const displayPrice = selectedVariant?.price ?? product?.price ?? 0;
  const displayStock = selectedVariant?.stockQuantity ?? product?.stockQuantity;
  const isOutOfStock = typeof displayStock === 'number' && displayStock <= 0;
  const selectedSizeLabel = selectedSize ?? (selectedVariant ? variantSize(selectedVariant) ?? null : null);
  const selectedColorLabel =
    colorOptions.find((color) => color.key === selectedColorKey)?.name ??
    (selectedVariant ? variantColor(selectedVariant)?.name ?? null : null);
  const richDescription = useMemo(() => {
    const d = normalizeDescriptionSource(product?.description?.trim() ?? '');
    if (!d) return '';
    if (!/[<][a-z!/]/i.test(d)) {
      return `<p>${escapeHtml(d).replace(/\n/g, '<br/>')}</p>`;
    }
    return sanitizeDescriptionHtml(d);
  }, [product?.description]);
  const galleryImages = useMemo(() => {
    const sameColorImages =
      selectedColorKey && variantRows.length
        ? uniqStrings(
            variantRows
              .filter((row) => row.color?.key === selectedColorKey && row.variant.image?.trim())
              .map((row) => row.variant.image as string)
          )
        : [];
    const list = uniqStrings([
      selectedVariant?.image,
      ...sameColorImages,
      ...(product?.images ?? []),
      product?.image,
    ]);
    return list.length > 0 ? list : ['https://placehold.co/800x1000/f0f0f0/666?text=Sin+imagen'];
  }, [product?.image, product?.images, selectedColorKey, selectedVariant?.image, variantRows]);

  /** Al cambiar color (o variante), la foto principal debe ser la de esa variante / ese color. */
  useEffect(() => {
    if (!galleryImages.length) return;
    setSelectedImage(galleryImages[0]);
  }, [selectedVariant?.id, selectedColorKey, galleryImages]);

  const related = products
    .filter((p) => p.id !== productId && p.category === product?.category)
    .slice(0, 4);

  const availableSizes = useMemo(() => {
    if (!selectedColorKey) return new Set(sizeOptions);
    return new Set(
      sizeOptions.filter((size) =>
        variantRows.some((row) => row.size === size && row.color?.key === selectedColorKey)
      )
    );
  }, [selectedColorKey, sizeOptions, variantRows]);

  const availableColors = useMemo(() => {
    if (!selectedSize) return new Set(colorOptions.map((color) => color.key));
    return new Set(
      colorOptions
        .filter((color) =>
          variantRows.some((row) => row.size === selectedSize && row.color?.key === color.key)
        )
        .map((color) => color.key)
    );
  }, [selectedSize, colorOptions, variantRows]);

  const handleSelectSize = (size: string) => {
    setSelectedVariantId(null);
    setSelectedSize(size);
    if (!selectedColorKey) return;
    const compatibleColors = colorsBySize.get(size) ?? [];
    if (!compatibleColors.some((item) => item.key === selectedColorKey)) {
      setSelectedColorKey(compatibleColors[0]?.key ?? null);
    }
  };

  const handleSelectColor = (colorKey: string) => {
    setSelectedVariantId(null);
    setSelectedColorKey(colorKey);
    if (!selectedSize) return;
    const compatibleSizes = sizesByColor.get(colorKey) ?? [];
    if (!compatibleSizes.includes(selectedSize)) {
      setSelectedSize(compatibleSizes[0] ?? null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-[120px] pb-24 px-6 md:px-[60px]">
        <p className="text-[16px] text-lupo-text">Cargando producto…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-[120px] pb-24 px-6 md:px-[60px] max-w-2xl">
        <p className="text-[16px] text-red-600 mb-2">No se pudo cargar el producto.</p>
        <p className="text-[14px] text-lupo-text whitespace-pre-wrap">{error}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen pt-[120px] pb-24 px-6 md:px-[60px] max-w-2xl">
        <p className="text-[16px] text-lupo-black mb-2">Producto no encontrado.</p>
        <p className="text-[14px] text-lupo-text mb-6">
          El producto que buscás no existe o ya no está disponible.
        </p>
        <Link
          to="/shop"
          className="inline-block bg-lupo-black text-white px-[28px] py-[12px] uppercase text-[11px] tracking-[1.6px] font-semibold"
        >
          Volver al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf8] pt-[116px] pb-24 px-4 md:px-8 lg:px-12">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(680px,1fr)_460px] gap-8 xl:gap-14 items-start max-w-[1680px] mx-auto">
        <div className="grid grid-cols-[84px_1fr] lg:grid-cols-[96px_1fr] gap-4 w-full">
          <div className="space-y-3">
            {galleryImages.slice(0, 10).map((img, idx) => {
              const active = img === selectedImage;
              return (
                <button
                  key={`${img}-${idx}`}
                  onClick={() => setSelectedImage(img)}
                  className={`w-full h-[84px] lg:h-[96px] border overflow-hidden bg-[#f5f5f5] transition-colors ${
                    active ? 'border-lupo-black' : 'border-[#e3e3e3]'
                  }`}
                >
                  <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              );
            })}
          </div>

          <div className="overflow-hidden w-full bg-neutral-100 ring-1 ring-inset ring-black/[0.05]">
            <img
              src={selectedImage || galleryImages[0]}
              alt={product.name}
              className="w-full h-[620px] md:h-[760px] xl:h-[820px] object-contain p-8 md:p-10"
            />
          </div>
        </div>

        <aside className="xl:sticky xl:top-[100px] border border-black/[0.06] bg-white p-6 md:p-8">
          <p className="text-[12px] text-[#8a8a8a] mb-4">Shop / {product.category}</p>
          <h1 className="text-[34px] leading-[1.08] tracking-[-0.6px] font-medium text-lupo-black mb-4">
            {product.name}
          </h1>
          <p className="text-[31px] font-medium text-lupo-black mb-7">${displayPrice.toFixed(2)}</p>

          {product.variants && product.variants.length > 0 && (
            <div className="mb-8 border-y border-[#e8e8e8] py-5 space-y-0">
              {colorOptions.length > 0 && (
                <div className="pb-5 border-b border-[#ececec]">
                  <div className="flex flex-wrap items-start gap-3">
                    <p className="text-[12px] uppercase tracking-[1.2px] font-medium min-w-[58px] pt-1.5">Color</p>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2">
                        {colorOptions.map((color) => {
                          const active = selectedColorKey === color.key;
                          const available = availableColors.has(color.key);
                          const swatchStyle = color.swatchCss
                            ? { background: color.swatchCss }
                            : color.hex
                              ? { backgroundColor: color.hex }
                              : { backgroundColor: '#dddddd' };
                          return (
                            <button
                              key={color.key}
                              onClick={() => handleSelectColor(color.key)}
                              className={`w-[36px] h-[36px] border rounded-full p-[3px] transition-all ${
                                active ? 'border-lupo-black' : 'border-[#d4d4d4]'
                              } ${!available ? 'opacity-45' : 'hover:border-lupo-black'}`}
                              title={color.name}
                              type="button"
                            >
                              <span
                                className="block w-full h-full rounded-full border border-black/15"
                                style={swatchStyle}
                              />
                            </button>
                          );
                        })}
                      </div>
                      {selectedColorLabel && (
                        <p className="text-[13px] text-[#666] mt-3">
                          Color seleccionado:{' '}
                          <span className="text-lupo-black font-medium">{selectedColorLabel}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {sizeOptions.length > 0 && (
                <div className="pt-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <p className="text-[12px] uppercase tracking-[1.2px] font-medium min-w-[58px] pt-1.5">Talle</p>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2">
                        {sizeOptions.map((size) => {
                          const active = selectedSize === size;
                          const available = availableSizes.has(size);
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => handleSelectSize(size)}
                              className={`h-[36px] min-w-[42px] px-3 border text-[12px] uppercase tracking-[0.5px] transition-all ${
                                active
                                  ? 'border-lupo-black bg-[#f2f2f2] text-lupo-black'
                                  : available
                                    ? 'border-[#d4d4d4] text-lupo-black hover:border-lupo-black'
                                    : 'border-[#e3e3e3] text-[#9f9f9f] line-through'
                              }`}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                      {selectedSizeLabel && (
                        <p className="text-[13px] text-[#666] mt-3">
                          Talle seleccionado:{' '}
                          <span className="text-lupo-black font-medium">{selectedSizeLabel}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!hasStructuredOptions && (
                <div>
                  <p className="text-[12px] uppercase tracking-[1.2px] font-medium mb-2">Variante</p>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`h-[36px] px-3 border text-[12px] uppercase tracking-[0.5px] transition-all ${
                          selectedVariant?.id === variant.id
                            ? 'border-lupo-black bg-[#f2f2f2] text-lupo-black'
                            : 'border-[#d4d4d4] text-lupo-black hover:border-lupo-black'
                        }`}
                      >
                        {variant.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {(!product.variants || product.variants.length === 0) && (
            <p className="text-[12px] text-[#777] mb-6">
              Este producto no tiene variantes estructuradas. Reimportá desde Tienda Nube para traer talles y colores.
            </p>
          )}

          <button
            onClick={() => {
              const suffix = [selectedSizeLabel, selectedColorLabel].filter(Boolean).join(' / ');
              addToCart({
                ...product,
                id: selectedVariant?.id ?? product.id,
                name: suffix ? `${product.name} - ${suffix}` : product.name,
                price: displayPrice,
                sku: product.sku,
                image: selectedVariant?.image || selectedImage || product.image,
              });
            }}
            disabled={isOutOfStock}
            className={`w-full py-[14px] rounded-xl uppercase text-[11px] tracking-[2px] font-semibold transition-colors mb-4 ${
              isOutOfStock
                ? 'bg-[#c8c8c8] text-white cursor-not-allowed'
                : 'bg-lupo-night text-white hover:opacity-90'
            }`}
          >
            {isOutOfStock ? 'Sin stock' : 'Agregar al carrito'}
          </button>

          {typeof displayStock === 'number' && (
            <p className="text-[12px] text-[#5c5c5c] mb-8">
              Disponibles: <span className="font-medium text-lupo-black">{displayStock}</span>
            </p>
          )}

          {richDescription && (
            <div
              className="product-description text-[14px] text-lupo-text leading-[1.8] border-t border-[#e8e8e8] pt-6"
              dangerouslySetInnerHTML={{ __html: richDescription }}
            />
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-[28px] font-light tracking-[-0.8px] mb-8">También te puede interesar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {related.map((item) => (
              <div key={item.id}>
                <ProductCard product={item} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
