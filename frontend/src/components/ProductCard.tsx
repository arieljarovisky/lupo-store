import { Link } from 'react-router-dom';
import { Product, useCart } from '../context/CartContext';
import { motion } from 'motion/react';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const detailPath = `/producto/${encodeURIComponent(product.id)}`;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="group flex flex-col lupo-shell rounded-2xl p-3"
    >
      <div className="relative aspect-[3/4] bg-[#edf2fc] rounded-xl overflow-hidden mb-4 border border-[#d9e1f1]">
        <Link to={detailPath} className="block w-full h-full">
          <img
            src={product.image || 'https://placehold.co/600x800/f0f0f0/666?text=Sin+imagen'}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </Link>
        
        {/* Quick Add Button overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 transform translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
          <button 
            onClick={(e) => {
              e.preventDefault();
              addToCart(product);
            }}
            className="w-full bg-white text-lupo-ink py-3 text-[11px] uppercase tracking-[1px] font-semibold shadow-sm border border-[#d9e1f1] hover:bg-[#f4f7fc] transition-colors rounded-lg"
          >
            Agregar al Carrito
          </button>
        </div>
      </div>
      
      <div className="flex justify-between items-start">
        <div>
          <Link to={detailPath} className="hover:text-lupo-night">
            <h3 className="font-medium text-[13px] mb-1 text-lupo-ink">{product.name}</h3>
          </Link>
          <p className="text-[11px] text-lupo-slate uppercase tracking-[1px]">{product.category}</p>
        </div>
        <span className="font-medium text-[13px] text-lupo-night">${product.price.toFixed(2)}</span>
      </div>
    </motion.div>
  );
}
