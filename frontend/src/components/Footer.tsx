import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';

export function Footer() {
  return (
    <footer className="hairline-top mt-20 bg-[#141414] text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-16 md:px-10 lg:px-12">
        <div className="grid grid-cols-1 gap-14 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-5">
            <BrandLogo to="/" className="max-h-11 brightness-0 invert opacity-95" />
            <p className="mt-8 max-w-sm text-[14px] leading-relaxed text-neutral-400">
              Calce, textura y durabilidad. Envíos a todo el país y atención por email y WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-2 md:col-span-7 md:grid-cols-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Comprar</p>
              <ul className="mt-5 space-y-3 text-[14px] text-neutral-300">
                <li>
                  <Link to="/shop" className="hover:text-white">
                    Todos los productos
                  </Link>
                </li>
                <li>
                  <Link to="/shop?category=hombre" className="hover:text-white">
                    Hombre
                  </Link>
                </li>
                <li>
                  <Link to="/shop?category=damas" className="hover:text-white">
                    Damas
                  </Link>
                </li>
                <li>
                  <Link to="/shop?category=deportivo" className="hover:text-white">
                    Deportivo
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Ayuda</p>
              <ul className="mt-5 space-y-3 text-[14px] text-neutral-300">
                <li>
                  <Link to="/shop" className="hover:text-white">
                    Envíos
                  </Link>
                </li>
                <li>
                  <Link to="/shop" className="hover:text-white">
                    Cambios
                  </Link>
                </li>
                <li>
                  <Link to="/shop" className="hover:text-white">
                    Contacto
                  </Link>
                </li>
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Operación</p>
              <ul className="mt-5 space-y-3 text-[14px] text-neutral-300">
                <li>
                  <Link to="/admin" className="hover:text-white">
                    Panel admin
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-6 border-t border-white/10 pt-8 text-[11px] text-neutral-500 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Lupo Store</p>
          <div className="flex gap-8">
            <Link to="/shop" className="hover:text-neutral-300">
              Privacidad
            </Link>
            <Link to="/shop" className="hover:text-neutral-300">
              Términos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
