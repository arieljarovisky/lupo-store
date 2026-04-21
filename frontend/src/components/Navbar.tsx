import { ShoppingBag, Menu, X, UserRound, LogOut } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { cn } from '../lib/utils';
import { BrandLogo } from './BrandLogo';

const navLink =
  'text-[13px] font-medium text-neutral-600 hover:text-neutral-900 transition-colors';

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAuthCard, setShowAuthCard] = useState(false);
  const { cartCount, setIsCartOpen } = useCart();
  const { customer, authError, loading, mountGoogleButton, logout } = useCustomerAuth();
  const location = useLocation();
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!showAuthCard || customer || !googleBtnRef.current) return;
    mountGoogleButton(googleBtnRef.current);
  }, [customer, mountGoogleButton, showAuthCard]);

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-40',
        'h-[72px] md:h-[76px]',
        'border-b border-black/[0.06] bg-[#fafaf8]/95 backdrop-blur-[8px]'
      )}
    >
      <div className="mx-auto flex h-full max-w-[1600px] items-center px-4 md:px-8 lg:px-10">
        <div className="flex w-full items-center gap-4">
          {/* Izquierda: menú móvil + logo */}
          <div className="flex min-w-0 shrink-0 items-center gap-3 md:gap-5">
            <button
              type="button"
              className="p-2 -ml-2 text-neutral-800 md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {isMobileMenuOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
            </button>
            <BrandLogo compact to="/" />
          </div>

          {/* Centro: navegación (desktop) */}
          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            <div className="flex items-center gap-8 lg:gap-10">
              <Link to="/shop" className={navLink}>
                Colección
              </Link>
              <Link to="/shop?category=hombre" className={navLink}>
                Hombre
              </Link>
              <Link to="/shop?category=damas" className={navLink}>
                Damas
              </Link>
              <Link to="/shop?category=deportivo" className={navLink}>
                Deportivo
              </Link>
            </div>
          </div>

          {/* Derecha: cuenta + admin + carrito */}
          <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
            <button
              type="button"
              onClick={() => setShowAuthCard((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-[12px] font-medium text-neutral-700 hover:bg-black/[0.03] md:px-3"
            >
              <UserRound size={16} strokeWidth={1.5} className="text-neutral-500" />
              <span className="hidden sm:inline">
                {customer?.fullName || customer?.email ? 'Cuenta' : 'Ingresar'}
              </span>
            </button>
            <Link
              to="/admin"
              className="hidden px-2 py-2 text-[12px] font-medium text-neutral-400 hover:text-neutral-700 sm:inline"
            >
              Admin
            </Link>
            <button
              type="button"
              className="relative inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-[12px] font-medium text-neutral-800 hover:bg-black/[0.03] md:px-3"
              onClick={() => setIsCartOpen(true)}
            >
              <ShoppingBag size={19} strokeWidth={1.5} />
              <span className="hidden md:inline">Carrito</span>
              {cartCount > 0 && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-semibold text-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {showAuthCard && (
        <div className="absolute right-4 top-full z-50 mt-1 w-[min(100vw-2rem,300px)] border border-black/[0.08] bg-white p-5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.18)] md:right-8">
          {customer ? (
            <div className="space-y-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">Sesión</p>
              <p className="text-[15px] font-medium leading-snug text-neutral-900">
                {customer.fullName || customer.email || `Cliente #${customer.id}`}
              </p>
              {customer.email && <p className="text-[13px] text-neutral-500">{customer.email}</p>}
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 text-[13px] font-medium text-neutral-700 hover:text-neutral-900"
              >
                <LogOut size={15} strokeWidth={1.5} />
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[13px] leading-relaxed text-neutral-600">
                Iniciá sesión con Google para completar más rápido el checkout.
              </p>
              <div ref={googleBtnRef} />
              {loading && <p className="text-[13px] text-neutral-500">Validando…</p>}
              {authError && <p className="text-[13px] text-red-600">{authError}</p>}
            </div>
          )}
        </div>
      )}

      {isMobileMenuOpen && (
        <div className="hairline-top absolute left-0 right-0 top-full bg-[#fafaf8] md:hidden">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-1 px-4 py-4">
            <Link to="/shop" className="py-3 text-[15px] font-medium text-neutral-900" onClick={() => setIsMobileMenuOpen(false)}>
              Colección
            </Link>
            <Link
              to="/shop?category=hombre"
              className="py-3 text-[15px] font-medium text-neutral-900"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Hombre
            </Link>
            <Link
              to="/shop?category=damas"
              className="py-3 text-[15px] font-medium text-neutral-900"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Damas
            </Link>
            <Link
              to="/shop?category=deportivo"
              className="py-3 text-[15px] font-medium text-neutral-900"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Deportivo
            </Link>
            <button
              type="button"
              onClick={() => {
                setShowAuthCard((v) => !v);
                setIsMobileMenuOpen(false);
              }}
              className="py-3 text-left text-[15px] font-medium text-neutral-900"
            >
              {customer ? 'Mi cuenta' : 'Ingresar con Google'}
            </button>
            <Link to="/admin" className="py-3 text-[14px] text-neutral-500" onClick={() => setIsMobileMenuOpen(false)}>
              Admin
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
