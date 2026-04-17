import { ShoppingBag, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { cn } from '../lib/utils';

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { cartCount, setIsCartOpen } = useCart();
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navClasses = cn(
    'fixed top-0 left-0 right-0 z-40 transition-all duration-300 ease-in-out px-6 md:px-[60px] h-[80px] flex items-center bg-white border-b border-lupo-border text-lupo-black'
  );

  return (
    <nav className={navClasses}>
      <div className="w-full flex items-center justify-between">
        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-2 -ml-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Logo */}
        <Link to="/" className="text-[24px] font-bold tracking-[4px] uppercase">
          Lupo
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center space-x-[30px] text-[12px] font-medium tracking-[1.5px] uppercase">
          <Link to="/shop" className="hover:opacity-70 transition-opacity">Colección</Link>
          <Link to="/shop?category=hombre" className="hover:opacity-70 transition-opacity">Hombre</Link>
          <Link to="/shop?category=damas" className="hover:opacity-70 transition-opacity">Damas</Link>
          <Link to="/shop?category=deportivo" className="hover:opacity-70 transition-opacity">Deportivo</Link>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <Link
            to="/admin"
            className="text-[12px] font-medium tracking-[1.5px] uppercase hover:opacity-70 transition-opacity"
          >
            Admin
          </Link>

          {/* Cart Button */}
          <button
            className="relative text-[12px] font-medium tracking-[1.5px] uppercase hover:opacity-70 transition-opacity flex items-center"
            onClick={() => setIsCartOpen(true)}
          >
            <span className="hidden md:inline mr-2">Carrito ({cartCount})</span>
            <ShoppingBag size={20} strokeWidth={1.5} className="md:hidden" />
            {cartCount > 0 && (
              <span className="md:hidden absolute -top-1 -right-1 bg-lupo-black text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-t border-lupo-border shadow-lg md:hidden">
          <div className="flex flex-col p-6 space-y-6 text-[12px] font-medium tracking-[1.5px] uppercase text-lupo-black">
            <Link to="/shop">Colección</Link>
            <Link to="/shop?category=hombre">Hombre</Link>
            <Link to="/shop?category=damas">Damas</Link>
            <Link to="/shop?category=deportivo">Deportivo</Link>
            <Link to="/admin">Admin</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
