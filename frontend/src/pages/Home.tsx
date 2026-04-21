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
    <div className="min-h-screen pt-[72px] md:pt-[76px]">
      {/* Hero editorial: tipografía + imagen a pantalla, sin “card” envolvente */}
      <section className="hairline-bottom">
        <div className="mx-auto grid max-w-[1600px] lg:grid-cols-12 lg:min-h-[calc(100vh-76px)]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col justify-center px-6 py-16 sm:px-10 lg:col-span-5 lg:px-12 lg:py-24 xl:pl-16"
          >
            <p className="font-accent-sugar text-[15px] text-neutral-500">Nueva temporada · 2026</p>
            <h1 className="mt-6 text-[clamp(2.125rem,4.2vw,3.25rem)] font-light leading-[1.08] tracking-[-0.03em] text-neutral-900">
              Diseño premium
              <br />
              que se siente.
            </h1>
            <p className="mt-8 max-w-[32ch] text-[15px] leading-[1.65] text-neutral-600">
              Ropa interior y deportiva con buen calce, telas suaves y uso diario. Hecho para durar.
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-4">
              <Link
                to="/shop"
                className="inline-flex min-h-[44px] items-center justify-center bg-neutral-900 px-9 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-neutral-800"
              >
                Ver colección
              </Link>
              <Link
                to="/shop?category=deportivo"
                className="group inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-900"
              >
                Línea deportiva
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.65, delay: 0.08 }}
            className="relative min-h-[52vh] bg-neutral-200 lg:col-span-7 lg:min-h-0"
          >
            <div className="pointer-events-none absolute left-6 top-6 z-10 max-w-[200px] border border-white/20 bg-neutral-900/75 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-white backdrop-blur-sm">
              Novedades
            </div>
            <img
              src="https://images.unsplash.com/photo-1552874869-5c39ec9288dc?q=80&w=1200&auto=format&fit=crop"
              alt=""
              className="h-full w-full object-cover"
            />
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-6 py-20 sm:px-10 lg:px-12 lg:py-28">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-end">
          <div>
            <h2 className="text-[clamp(1.5rem,2.5vw,1.875rem)] font-light tracking-[-0.02em] text-neutral-900">
              Colección destacada
            </h2>
            <div className="mt-4 flex items-center gap-3">
              <span className="h-px w-10 bg-neutral-900" aria-hidden />
              <p className="text-[14px] text-neutral-500">Selección curada</p>
            </div>
          </div>
          <Link
            to="/shop"
            className="group hidden items-center gap-2 self-start text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-900 md:inline-flex"
          >
            Ver todo el catálogo
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
          </Link>
        </div>

        <div className="mt-14 md:mt-16">
          {loading ? (
            <p className="text-[15px] text-neutral-500">Cargando productos…</p>
          ) : error ? (
            <p className="text-[15px] text-red-600">{error}</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-14 text-center md:hidden">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-900"
          >
            Ver catálogo
            <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      </section>
    </div>
  );
}
