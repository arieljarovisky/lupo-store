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
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group flex flex-col"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-neutral-100">
        <Link to={detailPath} className="block h-full w-full">
          <img
            src={product.image || 'https://placehold.co/600x800/f5f5f5/a3a3a3?text=Sin+imagen'}
            alt={product.name}
            className="h-full w-full object-cover transition-[transform,opacity] duration-[650ms] ease-out group-hover:scale-[1.03]"
          />
        </Link>
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/[0.04] transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute inset-x-0 bottom-0 translate-y-full p-3 transition-transform duration-300 ease-out group-hover:translate-y-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              addToCart(product);
            }}
            className="pointer-events-auto w-full bg-white/95 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-900 backdrop-blur-sm transition-colors hover:bg-white"
          >
            Agregar al carrito
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-4 border-t border-black/[0.06] pt-4">
        <div className="min-w-0">
          <Link to={detailPath} className="block">
            <h3 className="text-[14px] font-medium leading-snug text-neutral-900 line-clamp-2">{product.name}</h3>
          </Link>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">{product.category}</p>
        </div>
        <p className="shrink-0 tabular-nums text-[14px] font-medium text-neutral-900">${product.price.toFixed(2)}</p>
      </div>
    </motion.article>
  );
}
