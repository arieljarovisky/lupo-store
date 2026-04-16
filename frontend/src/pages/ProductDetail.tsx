import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useProductCatalog } from '../context/ProductCatalogContext';

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

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { products, loading, error } = useProductCatalog();
  const { addToCart } = useCart();

  const productId = decodeURIComponent(id ?? '');
  const product = products.find((p) => p.id === productId);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  useEffect(() => {
    if (!product?.variants?.length) {
      setSelectedVariantId(null);
      return;
    }
    setSelectedVariantId(product.variants[0].id);
  }, [productId, product?.variants]);

  const selectedVariant = useMemo(() => {
    if (!product?.variants?.length) return null;
    return (
      product.variants.find((v) => v.id === selectedVariantId) ??
      product.variants[0] ??
      null
    );
  }, [product?.variants, selectedVariantId]);

  const displayPrice = selectedVariant?.price ?? product?.price ?? 0;
  const displayStock = selectedVariant?.stockQuantity ?? product?.stockQuantity;
  const displaySku = selectedVariant?.sku ?? product?.sku;
  const richDescription = useMemo(() => {
    const d = product?.description?.trim();
    if (!d) return '';
    if (!/[<][a-z!/]/i.test(d)) {
      return `<p>${escapeHtml(d).replace(/\n/g, '<br/>')}</p>`;
    }
    return sanitizeDescriptionHtml(d);
  }, [product?.description]);

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
        <div className="bg-white border border-[#EEE] rounded-sm overflow-hidden w-full">
          <img
            src={product.image || 'https://placehold.co/800x1000/f0f0f0/666?text=Sin+imagen'}
            alt={product.name}
            className="w-full h-[520px] md:h-[620px] object-contain p-4 md:p-6"
          />
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
              <p className="text-[12px] uppercase tracking-[1.5px] font-medium mb-3 text-lupo-black">
                Elegí una variante
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => {
                  const isSelected = variant.id === selectedVariant?.id;
                  return (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`px-4 py-2 text-[12px] border transition-colors rounded-sm ${
                        isSelected
                          ? 'bg-lupo-black text-white border-lupo-black'
                          : 'bg-white text-lupo-black border-lupo-border hover:border-lupo-black'
                      }`}
                    >
                      {variant.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[12px] text-[#777] mt-3">
                {selectedVariant ? `Seleccionada: ${selectedVariant.name}` : ''}
              </p>
            </div>
          )}
          {(!product.variants || product.variants.length === 0) && (
            <p className="text-[12px] text-[#777] mb-8">
              Este producto no tiene variantes estructuradas. Si en Tienda Nube tiene talles/colores, reimportalo
              para traer la configuración actualizada.
            </p>
          )}

          <div className="space-y-3 mb-8 text-[13px] text-lupo-text">
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
              onClick={() => addToCart(product)}
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
