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

function variantSize(variant: ProductVariant): string | undefined {
  if (variant.size?.trim()) return variant.size.trim();
  const byOption = variant.optionValues?.find((ov) =>
    /(talle|talla|size)/i.test(ov.name) || /^(XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3})$/i.test(ov.value.trim())
  );
  return byOption?.value?.trim() || undefined;
}

function variantColor(variant: ProductVariant): { key: string; name: string; hex?: string } | null {
  const nameByOption = variant.optionValues?.find((ov) =>
    /color/i.test(ov.name) ||
    /(negro|blanco|azul|rojo|verde|gris|beige|brown|black|white|blue|red|green|gray|grey|pink)/i.test(
      ov.value
    )
  );
  const explicitName = variant.colorName?.trim() || nameByOption?.value?.trim();
  const explicitHex =
    normalizeColorHex(variant.colorHex) || normalizeColorHex(nameByOption?.swatch);

  if (!explicitName && !explicitHex) return null;
  const label = explicitName || explicitHex || 'Color';
  return {
    key: (explicitName || explicitHex || '').toLowerCase(),
    name: label,
    hex: explicitHex,
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
      size: variantSize(variant) ?? null,
      color: variantColor(variant),
    }));
  }, [product?.variants]);

  const sizeOptions = useMemo(
    () => uniqStrings(variantRows.map((r) => r.size)),
    [variantRows]
  );

  const colorOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ key: string; name: string; hex?: string }> = [];
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
  const displaySku = selectedVariant?.sku ?? product?.sku;
  const isOutOfStock = typeof displayStock === 'number' && displayStock <= 0;
  const selectedSizeLabel = selectedVariant ? variantSize(selectedVariant) : null;
  const selectedColorLabel = selectedVariant ? variantColor(selectedVariant)?.name ?? null : null;
  const richDescription = useMemo(() => {
    const d = product?.description?.trim();
    if (!d) return '';
    if (!/[<][a-z!/]/i.test(d)) {
      return `<p>${escapeHtml(d).replace(/\n/g, '<br/>')}</p>`;
    }
    return sanitizeDescriptionHtml(d);
  }, [product?.description]);
  const galleryImages = useMemo(() => {
    const list = uniqStrings([
      selectedVariant?.image,
      ...(product?.images ?? []),
      product?.image,
    ]);
    return list.length > 0 ? list : ['https://placehold.co/800x1000/f0f0f0/666?text=Sin+imagen'];
  }, [product?.image, product?.images, selectedVariant?.image]);

  useEffect(() => {
    if (!galleryImages.length) return;
    if (!selectedImage || !galleryImages.includes(selectedImage)) {
      setSelectedImage(galleryImages[0]);
    }
  }, [galleryImages, selectedImage]);

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
    <div className="min-h-screen pt-[120px] pb-24 px-6 md:px-[60px] bg-[#fafafa]">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(380px,520px)_1fr] gap-10 lg:gap-16 items-start">
        <div className="grid grid-cols-[76px_1fr] gap-3 md:gap-4 w-full">
          <div className="space-y-2">
            {galleryImages.slice(0, 8).map((img, idx) => {
              const active = img === selectedImage;
              return (
                <button
                  key={`${img}-${idx}`}
                  onClick={() => setSelectedImage(img)}
                  className={`w-full h-[76px] border overflow-hidden bg-white ${
                    active ? 'border-lupo-black' : 'border-lupo-border'
                  }`}
                >
                  <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              );
            })}
          </div>
          <div className="bg-white border border-[#EEE] rounded-sm overflow-hidden w-full">
            <img
              src={selectedImage || galleryImages[0]}
              alt={product.name}
              className="w-full h-[520px] md:h-[620px] object-contain p-4 md:p-6"
            />
          </div>
        </div>

        <div className="flex flex-col max-w-[760px] bg-white border border-[#eee] p-6 md:p-10 rounded-sm shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
          <p className="text-[11px] text-[#777] uppercase tracking-[1.5px] mb-4">{product.category}</p>
          <h1 className="text-[36px] md:text-[46px] font-light tracking-[-1px] leading-[1.1] mb-5">
            {product.name}
          </h1>
          <p className="text-[26px] font-medium text-lupo-black mb-6">${displayPrice.toFixed(2)}</p>
          {richDescription ? (
            <div
              className="product-description text-[15px] text-lupo-text leading-[1.8] mb-8"
              dangerouslySetInnerHTML={{ __html: richDescription }}
            />
          ) : (
            <p className="text-[15px] text-lupo-text leading-[1.8] mb-8">
              Sin descripción disponible para este producto.
            </p>
          )}

          {product.variants && product.variants.length > 0 && (
            <div className="mb-8 p-5 md:p-6 border border-lupo-border bg-[#fcfcfc] rounded-sm">
              <div className="flex items-center justify-between mb-5">
                <p className="text-[12px] uppercase tracking-[1.5px] font-medium text-lupo-black">
                  Elegí tu variante
                </p>
                {selectedVariant && (
                  <p className="text-[11px] text-[#777] uppercase tracking-[1.2px]">{selectedVariant.name}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sizeOptions.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-[1.2px] text-[#666] mb-2">Talle</p>
                    <div className="flex flex-wrap gap-2">
                      {sizeOptions.map((size) => {
                        const active = selectedSize === size;
                        const available = availableSizes.has(size);
                        return (
                          <button
                            key={size}
                            onClick={() => handleSelectSize(size)}
                            className={`min-w-[48px] px-4 py-2 text-[12px] border rounded-sm transition-all ${
                              active
                                ? 'bg-lupo-black text-white border-lupo-black'
                                : available
                                  ? 'bg-white text-lupo-black border-lupo-border hover:border-lupo-black'
                                  : 'bg-[#f3f3f3] text-[#999] border-[#e4e4e4]'
                            }`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {colorOptions.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-[1.2px] text-[#666] mb-2">Color</p>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map((color) => {
                        const active = selectedColorKey === color.key;
                        const available = availableColors.has(color.key);
                        return (
                          <button
                            key={color.key}
                            onClick={() => handleSelectColor(color.key)}
                            className={`px-3 py-2 text-[12px] border rounded-sm flex items-center gap-2 transition-all ${
                              active
                                ? 'bg-lupo-black text-white border-lupo-black'
                                : available
                                  ? 'bg-white text-lupo-black border-lupo-border hover:border-lupo-black'
                                  : 'bg-[#f3f3f3] text-[#999] border-[#e4e4e4]'
                            }`}
                          >
                            <span
                              className="inline-block w-3 h-3 rounded-full border border-black/20"
                              style={color.hex ? { backgroundColor: color.hex } : { backgroundColor: '#e5e5e5' }}
                            />
                            <span>{color.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {!hasStructuredOptions && (
                <div className="mt-1">
                  <p className="text-[11px] uppercase tracking-[1.2px] text-[#666] mb-2">Variantes</p>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`px-4 py-2 text-[12px] border rounded-sm transition-colors ${
                          selectedVariant?.id === variant.id
                            ? 'bg-lupo-black text-white border-lupo-black'
                            : 'bg-white text-lupo-black border-lupo-border hover:border-lupo-black'
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
            <p className="text-[12px] text-[#777] mb-8">
              Este producto no tiene variantes estructuradas. Si en Tienda Nube tiene talles/colores, reimportalo
              para traer la configuración actualizada.
            </p>
          )}

          <div className="space-y-3 mb-8 text-[13px] text-lupo-text">
            {selectedSizeLabel && (
              <p>
                <span className="font-medium text-lupo-black">Talle:</span> {selectedSizeLabel}
              </p>
            )}
            {selectedColorLabel && (
              <p>
                <span className="font-medium text-lupo-black">Color:</span> {selectedColorLabel}
              </p>
            )}
            {displaySku && (
              <p>
                <span className="font-medium text-lupo-black">SKU:</span> {displaySku}
              </p>
            )}
            {typeof displayStock === 'number' && (
              <p>
                <span className="font-medium text-lupo-black">Stock:</span> {displayStock}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                const suffix = [selectedSizeLabel, selectedColorLabel].filter(Boolean).join(' / ');
                addToCart({
                  ...product,
                  id: selectedVariant?.id ?? product.id,
                  name: suffix ? `${product.name} - ${suffix}` : product.name,
                  price: displayPrice,
                  sku: displaySku,
                  image: selectedVariant?.image || selectedImage || product.image,
                });
              }}
              disabled={isOutOfStock}
              className={`px-[32px] py-[14px] uppercase text-[11px] tracking-[2px] font-semibold transition-colors ${
                isOutOfStock
                  ? 'bg-[#c8c8c8] text-white cursor-not-allowed'
                  : 'bg-lupo-black text-white hover:bg-black/80'
              }`}
            >
              {isOutOfStock ? 'Sin stock' : 'Agregar al carrito'}
            </button>
            <Link
              to={`/shop?category=${encodeURIComponent(product.category.toLowerCase())}`}
              className="border border-lupo-border px-[28px] py-[14px] uppercase text-[11px] tracking-[2px] font-semibold hover:border-lupo-black transition-colors"
            >
              Ver categoría
            </Link>
          </div>
        </div>
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
