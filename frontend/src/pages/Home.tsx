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
    <div className="min-h-screen pt-[80px]">
      {/* Hero Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-10 p-6 md:p-[60px] min-h-[calc(100vh-80px)]">
        <div className="flex flex-col justify-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="text-[11px] uppercase tracking-[2px] text-lupo-muted mb-5">
              Nueva Temporada 2024
            </div>
            <h1 className="text-[40px] md:text-[56px] font-light leading-[1.1] tracking-[-1px] mb-6">
              Comodidad<br />sin límites.
            </h1>
            <p className="text-[16px] leading-[1.6] text-lupo-text mb-10 max-w-[400px]">
              Descubrí nuestra nueva línea de ropa interior y deportiva. Diseñada en Argentina con tecnología seamless para tu día a día.
            </p>
            <div className="flex flex-wrap gap-[15px]">
              <Link 
                to="/shop" 
                className="bg-lupo-black text-white px-[40px] py-[18px] uppercase text-[12px] tracking-[2px] font-semibold hover:bg-black/80 transition-colors inline-block text-center"
              >
                Comprar Ahora
              </Link>
              <Link 
                to="/shop?category=deportivo" 
                className="bg-transparent text-lupo-black border border-lupo-black px-[40px] py-[18px] uppercase text-[12px] tracking-[2px] font-semibold hover:bg-gray-50 transition-colors inline-block text-center"
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
          className="bg-[#F0F0F0] border border-[#EEE] flex items-center justify-center relative overflow-hidden min-h-[400px] md:min-h-full"
        >
          <div className="absolute top-[30px] right-[30px] bg-white text-lupo-black px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1px] shadow-sm border border-lupo-border z-10">
            Alta Conversión
          </div>
          <img 
            src="https://images.unsplash.com/photo-1552874869-5c39ec9288dc?q=80&w=1000&auto=format&fit=crop" 
            alt="Lupo Collection" 
            className="w-full h-full object-cover"
          />
        </motion.div>
      </section>

      {/* Featured Products */}
      <section className="py-24 px-6 md:px-[60px] bg-white border-t border-lupo-border">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-[32px] font-light tracking-[-1px] mb-2">Colección Destacada</h2>
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
