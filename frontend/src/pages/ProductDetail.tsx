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

    const byCombo = variantRows.find((row) => {
      const okSize = selectedSize ? row.size === selectedSize : true;
      const okColor = selectedColorKey ? row.color?.key === selectedColorKey : true;
      return okSize && okColor;
    });
    if (byCombo) return byCombo.variant;

    const byId = selectedVariantId
      ? variantRows.find((row) => row.variant.id === selectedVariantId)?.variant
      : null;
    return byId ?? variantRows[0].variant;
  }, [variantRows, selectedColorKey, selectedSize, selectedVariantId]);

  useEffect(() => {
    if (!selectedVariant) return;
    setSelectedVariantId(selectedVariant.id);
    const row = variantRows.find((x) => x.variant.id === selectedVariant.id);
    if (row?.size) setSelectedSize(row.size);
    if (row?.color) setSelectedColorKey(row.color.key);
  }, [selectedVariant, variantRows]);

  const displayPrice = selectedVariant?.price ?? product?.price ?? 0;
  const displayStock = selectedVariant?.stockQuantity ?? product?.stockQuantity;
  const displaySku = selectedVariant?.sku ?? product?.sku;
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
    <div className="min-h-screen pt-[120px] pb-24 px-6 md:px-[60px]">
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

        <div className="flex flex-col max-w-[760px]">
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
            <div className="mb-8 p-4 border border-lupo-border bg-white">
              <p className="text-[12px] uppercase tracking-[1.5px] font-medium mb-4 text-lupo-black">
                Elegí una variante
              </p>

              {sizeOptions.length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] uppercase tracking-[1.2px] text-[#666] mb-2">Talle</p>
                  <div className="flex flex-wrap gap-2">
                    {sizeOptions.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2 text-[12px] border rounded-sm transition-colors ${
                          selectedSize === size
                            ? 'bg-lupo-black text-white border-lupo-black'
                            : 'bg-white text-lupo-black border-lupo-border hover:border-lupo-black'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {colorOptions.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] uppercase tracking-[1.2px] text-[#666] mb-2">Color</p>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => {
                      const active = selectedColorKey === color.key;
                      return (
                        <button
                          key={color.key}
                          onClick={() => setSelectedColorKey(color.key)}
                          className={`px-3 py-2 text-[12px] border rounded-sm flex items-center gap-2 transition-colors ${
                            active
                              ? 'bg-lupo-black text-white border-lupo-black'
                              : 'bg-white text-lupo-black border-lupo-border hover:border-lupo-black'
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

              {sizeOptions.length === 0 && colorOptions.length === 0 && (
                <div className="mb-3">
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

              {selectedVariant && (
                <p className="text-[12px] text-[#777] mt-3">
                  Seleccionada: {selectedVariant.name}
                </p>
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
                  name: suffix ? `${product.name} - ${suffix}` : product.name,
                  price: displayPrice,
                  sku: displaySku,
                  image: selectedVariant?.image || selectedImage || product.image,
                });
              }}
              className="bg-lupo-black text-white px-[32px] py-[14px] uppercase text-[11px] tracking-[2px] font-semibold hover:bg-black/80 transition-colors"
            >
              Agregar al carrito
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
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
