import { useMemo } from 'react';
import { ProductCard } from '../components/ProductCard';
import { useSearchParams } from 'react-router-dom';
import { useProductCatalog } from '../context/ProductCatalogContext';
import type { Product } from '../context/CartContext';

export function Shop() {
  const { products, loading, error } = useProductCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category');

  const categories = useMemo(() => {
    const unique = [...new Set(products.map((p) => p.category))].sort();
    return ['Todos', ...unique];
  }, [products]);

  const filteredProducts: Product[] =
    categoryFilter && categoryFilter !== 'todos'
      ? products.filter((p) => p.category.toLowerCase() === categoryFilter.toLowerCase())
      : products;

  const handleCategoryClick = (category: string) => {
    if (category === 'Todos') {
      setSearchParams({});
    } else {
      setSearchParams({ category: category.toLowerCase() });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafaf8] pt-[120px] pb-24 px-6 md:px-10">
        <p className="text-[15px] text-neutral-500">Cargando catálogo…</p>
      </div>
    );
  }

  if (error) {
    const isDevHint =
      import.meta.env.DEV &&
      !error.includes('Vercel') &&
      !error.includes('404/HTML') &&
      !error.includes('mismo origen');
    return (
      <div className="min-h-screen bg-[#fafaf8] pt-[120px] pb-24 px-6 md:px-10 max-w-2xl">
        <p className="text-[16px] text-red-600 mb-2">No se pudo cargar el catálogo.</p>
        <p className="text-[14px] text-neutral-600 whitespace-pre-wrap">{error}</p>
        {isDevHint ? (
          <p className="text-[13px] text-neutral-600 mt-4">
            En local: <code className="text-xs bg-neutral-100 px-1">npm run dev</code> en la raíz del proyecto.
          </p>
        ) : (
          <p className="text-[13px] text-neutral-600 mt-4 leading-relaxed">
            En producción: el front tiene que apuntar al backend. Definí{' '}
            <code className="text-xs bg-neutral-100 px-1">VITE_API_URL</code> con la URL del API al hacer build, o
            desplegá API + sitio en el mismo servicio (Express sirve <code className="text-xs bg-neutral-100 px-1">/api</code>{' '}
            y los archivos estáticos).
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf8] pt-[120px] pb-28 px-6 md:px-10 lg:px-12">
      <div className="mx-auto max-w-[1600px]">
        <header className="hairline-bottom pb-10 md:flex md:items-end md:justify-between md:gap-12">
          <div className="max-w-xl">
            <h1 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-light tracking-[-0.03em] text-neutral-900">
              Catálogo
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-neutral-600">
              Filtrá por categoría. Misma calidad, distintos usos.
            </p>
          </div>

          <nav className="mt-10 flex flex-wrap gap-x-1 gap-y-2 md:mt-0 md:justify-end" aria-label="Filtros de categoría">
            {categories.map((category) => {
              const isActive =
                (category === 'Todos' && !categoryFilter) ||
                (categoryFilter && category.toLowerCase() === categoryFilter.toLowerCase());

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategoryClick(category)}
                  className={`relative px-3 py-2 text-[12px] font-medium transition-colors md:px-4 ${
                    isActive ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-700'
                  }`}
                >
                  {category}
                  {isActive && (
                    <span className="absolute bottom-1 left-3 right-3 h-px bg-neutral-900 md:left-4 md:right-4" />
                  )}
                </button>
              );
            })}
          </nav>
        </header>

        {filteredProducts.length > 0 ? (
          <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="py-24 text-center">
            <p className="text-[15px] text-neutral-600">No hay productos en esta categoría.</p>
            <button
              type="button"
              onClick={() => handleCategoryClick('Todos')}
              className="mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-900 underline underline-offset-4"
            >
              Ver todo el catálogo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
