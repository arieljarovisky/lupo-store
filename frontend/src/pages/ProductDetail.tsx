import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useProductCatalog } from '../context/ProductCatalogContext';

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
        <div className="bg-[#F0F0F0] border border-[#EEE] overflow-hidden max-w-[560px] max-h-[700px] w-full">
          <img
            src={product.image || 'https://placehold.co/800x1000/f0f0f0/666?text=Sin+imagen'}
            alt={product.name}
            className="w-full h-full object-contain"
          />
        </div>

        <div className="flex flex-col">
          <p className="text-[11px] text-[#777] uppercase tracking-[1.5px] mb-4">{product.category}</p>
          <h1 className="text-[36px] md:text-[46px] font-light tracking-[-1px] leading-[1.1] mb-5">
            {product.name}
          </h1>
          <p className="text-[26px] font-medium text-lupo-black mb-6">${displayPrice.toFixed(2)}</p>
          <p className="text-[15px] text-lupo-text leading-[1.85] whitespace-pre-line mb-8 max-w-[640px]">
            {product.description?.trim() || 'Sin descripción disponible para este producto.'}
          </p>

          {product.variants && product.variants.length > 0 && (
            <div className="mb-8">
              <p className="text-[12px] uppercase tracking-[1.5px] font-medium mb-3 text-lupo-black">Variantes</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => {
                  const isSelected = variant.id === selectedVariant?.id;
                  return (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`px-4 py-2 text-[12px] border transition-colors ${
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
            </div>
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
