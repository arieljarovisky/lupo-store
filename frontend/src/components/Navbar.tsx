import { ShoppingBag, Menu, X, UserRound, LogOut } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { cn } from '../lib/utils';
import { BrandLogo } from './BrandLogo';

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

  const navClasses = cn(
    'fixed top-0 left-0 right-0 z-40 transition-all duration-300 ease-in-out px-4 md:px-8 lg:px-12 h-[84px] flex items-center bg-white/95 backdrop-blur border-b border-[#dfe5f2] text-lupo-black'
  );

  return (
    <nav className={navClasses}>
      <div className="w-full flex items-center justify-between">
        <button
          className="md:hidden p-2 -ml-2 text-lupo-ink"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <BrandLogo compact to="/" />

        <div className="hidden md:flex items-center space-x-6 text-[12px] font-semibold tracking-[0.08em] uppercase text-lupo-slate">
          <Link to="/shop" className="hover:text-lupo-ink transition-colors">Colección</Link>
          <Link to="/shop?category=hombre" className="hover:text-lupo-ink transition-colors">Hombre</Link>
          <Link to="/shop?category=damas" className="hover:text-lupo-ink transition-colors">Damas</Link>
          <Link to="/shop?category=deportivo" className="hover:text-lupo-ink transition-colors">Deportivo</Link>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          <button
            type="button"
            onClick={() => setShowAuthCard((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-[#d8e0f0] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-lupo-ink hover:border-lupo-ink"
          >
            <UserRound size={14} />
            {customer?.fullName || customer?.email ? 'Mi cuenta' : 'Ingresar'}
          </button>
          <Link
            to="/admin"
            className="text-[12px] font-semibold tracking-[0.08em] uppercase text-lupo-slate hover:text-lupo-ink transition-colors"
          >
            Admin
          </Link>

          <button
            className="relative text-[12px] font-semibold tracking-[0.08em] uppercase text-lupo-ink hover:opacity-80 transition-opacity flex items-center"
            onClick={() => setIsCartOpen(true)}
          >
            <span className="hidden md:inline mr-2">Carrito ({cartCount})</span>
            <ShoppingBag size={20} strokeWidth={1.5} className="md:hidden" />
            {cartCount > 0 && (
              <span className="md:hidden absolute -top-1 -right-1 bg-lupo-night text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {showAuthCard && (
        <div className="absolute top-full right-4 md:right-8 mt-2 w-[290px] rounded-2xl border border-[#dbe3f3] bg-white p-4 shadow-xl">
          {customer ? (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-lupo-slate">Sesión activa</p>
              <p className="text-[14px] text-lupo-ink font-medium">
                {customer.fullName || customer.email || `Cliente #${customer.id}`}
              </p>
              {customer.email && <p className="text-[12px] text-lupo-slate">{customer.email}</p>}
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 text-[12px] font-semibold text-lupo-ink hover:text-lupo-night"
              >
                <LogOut size={14} />
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-lupo-slate">Clientes</p>
              <p className="text-[13px] text-lupo-text">
                Ingresá con Google para autocompletar tus datos y seguir tus pedidos.
              </p>
              <div ref={googleBtnRef} />
              {loading && <p className="text-[12px] text-lupo-text">Validando cuenta…</p>}
              {authError && <p className="text-[12px] text-red-600">{authError}</p>}
            </div>
          )}
        </div>
      )}

      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-t border-[#dfe5f2] shadow-lg md:hidden">
          <div className="flex flex-col p-6 space-y-5 text-[12px] font-semibold tracking-[0.08em] uppercase text-lupo-ink">
            <Link to="/shop">Colección</Link>
            <Link to="/shop?category=hombre">Hombre</Link>
            <Link to="/shop?category=damas">Damas</Link>
            <Link to="/shop?category=deportivo">Deportivo</Link>
            <button
              type="button"
              onClick={() => setShowAuthCard((v) => !v)}
              className="text-left"
            >
              {customer ? 'Mi cuenta' : 'Ingresar con Google'}
            </button>
            <Link to="/admin">Admin</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
