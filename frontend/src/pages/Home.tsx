import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ProductCard } from '../components/ProductCard';
import { useProductCatalog } from '../context/ProductCatalogContext';
import type { Product } from '../context/CartContext';

export function Home() {
  const { products, loading, error } = useProductCatalog();
  const featuredProducts: Product[] = products.slice(0, 4);

  return (
    <div className="min-h-screen pt-[92px]">
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 p-4 md:p-8 lg:p-12 min-h-[calc(100vh-92px)]">
        <div className="flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="lupo-shell rounded-3xl p-8 md:p-10"
          >
            <div className="text-[11px] uppercase tracking-[2px] text-lupo-slate mb-5">
              Nueva Temporada 2026
            </div>
            <h1 className="text-[40px] md:text-[56px] font-light leading-[1.1] tracking-[-1px] mb-6 text-lupo-night">
              Diseño premium<br />que se siente.
            </h1>
            <p className="text-[16px] leading-[1.6] text-lupo-text mb-10 max-w-[400px]">
              Colección de ropa interior y deportiva con ajuste ergonómico, telas suaves y rendimiento diario.
            </p>
            <div className="flex flex-wrap gap-[15px]">
              <Link 
                to="/shop" 
                className="bg-lupo-night text-white px-[34px] py-[16px] rounded-xl uppercase text-[12px] tracking-[2px] font-semibold hover:opacity-90 transition-colors inline-block text-center"
              >
                Comprar Ahora
              </Link>
              <Link 
                to="/shop?category=deportivo" 
                className="bg-transparent text-lupo-ink border border-[#bcc9e4] px-[34px] py-[16px] rounded-xl uppercase text-[12px] tracking-[2px] font-semibold hover:bg-[#f5f8ff] transition-colors inline-block text-center"
              >
                Línea Deportiva
              </Link>
            </div>
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="lupo-shell rounded-3xl flex items-center justify-center relative overflow-hidden min-h-[400px] md:min-h-full"
        >
          <div className="absolute top-[24px] right-[24px] bg-lupo-night text-lupo-sky px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1px] shadow-sm z-10 rounded-full">
            Colección destacada
          </div>
          <img 
            src="https://images.unsplash.com/photo-1552874869-5c39ec9288dc?q=80&w=1000&auto=format&fit=crop" 
            alt="Lupo Collection" 
            className="w-full h-full object-cover"
          />
        </motion.div>
      </section>

      <section className="py-20 px-4 md:px-8 lg:px-12 border-t border-[#dfe5f2]">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-[32px] font-light tracking-[-1px] mb-2 text-lupo-night">Colección Destacada</h2>
            <p className="text-lupo-text text-[16px]">Selección de nuestros mejores productos.</p>
          </div>
          <Link to="/shop" className="hidden md:flex items-center text-[12px] font-semibold uppercase tracking-[1.5px] hover:opacity-70 transition-opacity">
            Ver Todos <ArrowRight size={16} className="ml-2" />
          </Link>
        </div>
        
        {loading ? (
          <p className="text-[15px] text-lupo-text">Cargando productos…</p>
        ) : error ? (
          <p className="text-[15px] text-red-600">{error}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredProducts.map((product) => (
              <div key={product.id}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-12 text-center md:hidden">
          <Link to="/shop" className="inline-flex items-center text-[12px] font-semibold uppercase tracking-[1.5px] hover:opacity-70 transition-opacity border-b border-lupo-black pb-1">
            Ver Todos
          </Link>
        </div>
      </section>
    </div>
  );
}
