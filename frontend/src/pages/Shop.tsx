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
      <div className="min-h-screen pt-[120px] pb-24 px-6 md:px-[60px]">
        <p className="text-[16px] text-lupo-text">Cargando catálogo…</p>
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
      <div className="min-h-screen pt-[120px] pb-24 px-6 md:px-[60px] max-w-2xl">
        <p className="text-[16px] text-red-600 mb-2">No se pudo cargar el catálogo.</p>
        <p className="text-[14px] text-lupo-text whitespace-pre-wrap">{error}</p>
        {isDevHint ? (
          <p className="text-[13px] text-lupo-text mt-4">
            En local: <code className="text-xs bg-gray-100 px-1">npm run dev</code> en la raíz del proyecto.
          </p>
        ) : (
          <p className="text-[13px] text-lupo-text mt-4 leading-relaxed">
            En producción: el front tiene que apuntar al backend. Definí{' '}
            <code className="text-xs bg-gray-100 px-1">VITE_API_URL</code> con la URL del API al hacer build, o
            desplegá API + sitio en el mismo servicio (Express sirve <code className="text-xs bg-gray-100 px-1">/api</code>{' '}
            y los archivos estáticos).
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-[120px] pb-24 px-6 md:px-[60px]">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div>
          <h1 className="text-[40px] md:text-[56px] font-light tracking-[-1px] leading-[1.1] mb-4">Catálogo</h1>
          <p className="text-[16px] text-lupo-text max-w-md leading-[1.6]">Explora nuestra colección completa de esenciales minimalistas.</p>
        </div>
        
        {/* Category Filter */}
        <div className="flex flex-wrap gap-3">
          {categories.map(category => {
            const isActive = 
              (category === 'Todos' && !categoryFilter) || 
              (categoryFilter && category.toLowerCase() === categoryFilter.toLowerCase());
              
            return (
              <button
                key={category}
                onClick={() => handleCategoryClick(category)}
                className={`px-6 py-2.5 text-[11px] uppercase tracking-[1px] font-semibold transition-colors border ${
                  isActive 
                    ? 'bg-lupo-black text-white border-lupo-black' 
                    : 'bg-transparent text-lupo-black border-lupo-border hover:border-lupo-black'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>
      
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
          {filteredProducts.map((product) => (
            <div key={product.id}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center">
          <p className="text-[16px] text-lupo-text">No se encontraron productos en esta categoría.</p>
          <button 
            onClick={() => handleCategoryClick('Todos')}
            className="mt-6 text-[12px] uppercase tracking-[1.5px] font-semibold text-lupo-black border-b border-lupo-black pb-1"
          >
            Limpiar Filtros
          </button>
        </div>
      )}
    </div>
  );
}
