import { Link } from 'react-router-dom';
import { Product, useCart } from '../context/CartContext';
import { motion } from 'motion/react';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="group flex flex-col"
    >
      <div className="relative aspect-[3/4] bg-[#F0F0F0] rounded-[2px] overflow-hidden mb-4 border border-[#EEE]">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        
        {/* Quick Add Button overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 transform translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
          <button 
            onClick={(e) => {
              e.preventDefault();
              addToCart(product);
            }}
            className="w-full bg-white text-lupo-black py-3 text-[11px] uppercase tracking-[1px] font-semibold shadow-sm border border-lupo-border hover:bg-gray-50 transition-colors"
          >
            Agregar al Carrito
          </button>
        </div>
      </div>
      
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-[13px] mb-1 text-lupo-black">{product.name}</h3>
          <p className="text-[11px] text-[#777] uppercase tracking-[1px]">{product.category}</p>
        </div>
        <span className="font-medium text-[13px] text-lupo-black">${product.price.toFixed(2)}</span>
      </div>
    </motion.div>
  );
}
