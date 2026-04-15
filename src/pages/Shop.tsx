import { useState } from 'react';
import { ProductCard } from '../components/ProductCard';
import { products } from '../data/products';
import { useSearchParams } from 'react-router-dom';

export function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category');
  
  const categories = ['Todos', 'Hombre', 'Damas', 'Deportivo', 'Medias'];
  
  const filteredProducts = categoryFilter && categoryFilter !== 'todos'
    ? products.filter(p => p.category.toLowerCase() === categoryFilter.toLowerCase())
    : products;

  const handleCategoryClick = (category: string) => {
    if (category === 'Todos') {
      setSearchParams({});
    } else {
      setSearchParams({ category: category.toLowerCase() });
    }
  };

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
          {filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
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
