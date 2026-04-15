import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-white border-t border-lupo-border">
      {/* Features Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6 md:p-[60px] border-b border-lupo-border">
        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] uppercase tracking-[1px] text-lupo-black font-semibold m-0">Pagos Flexibles</h3>
          <p className="text-[13px] text-[#777] m-0 leading-[1.4]">6 Cuotas sin interés con todas las tarjetas bancarias.</p>
          <div className="flex gap-2.5 mt-2.5">
            <div className="w-9 h-[22px] bg-[#F0F0F0] rounded-[3px]"></div>
            <div className="w-9 h-[22px] bg-[#F0F0F0] rounded-[3px]"></div>
            <div className="w-9 h-[22px] bg-[#F0F0F0] rounded-[3px]"></div>
            <div className="w-9 h-[22px] bg-[#F0F0F0] rounded-[3px]"></div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] uppercase tracking-[1px] text-lupo-black font-semibold m-0">Logística Inteligente</h3>
          <p className="text-[13px] text-[#777] m-0 leading-[1.4]">Envíos rápidos a todo el país con seguimiento en tiempo real.</p>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] uppercase tracking-[1px] text-lupo-black font-semibold m-0">Escalabilidad Lupo</h3>
          <p className="text-[13px] text-[#777] m-0 leading-[1.4]">Infraestructura optimizada para el crecimiento de tu negocio.</p>
        </div>
      </div>

      {/* Main Footer */}
      <div className="p-6 md:p-[60px] grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="md:col-span-2">
          <Link to="/" className="text-[24px] font-bold tracking-[4px] uppercase mb-6 block text-lupo-black">
            LUPO
          </Link>
          <p className="text-lupo-text max-w-sm text-[13px] leading-[1.6]">
            Diseño minimalista pensado para potenciar tu vida cotidiana. Calidad excepcional sin intermediarios.
          </p>
        </div>
        
        <div>
          <h4 className="text-[11px] uppercase tracking-[1px] text-lupo-black font-semibold mb-6">Shop</h4>
          <ul className="space-y-4 text-[13px] text-[#777]">
            <li><Link to="/shop" className="hover:text-lupo-black transition-colors">Todos los Productos</Link></li>
            <li><Link to="/shop?category=hombre" className="hover:text-lupo-black transition-colors">Hombre</Link></li>
            <li><Link to="/shop?category=damas" className="hover:text-lupo-black transition-colors">Damas</Link></li>
            <li><Link to="/shop?category=deportivo" className="hover:text-lupo-black transition-colors">Deportivo</Link></li>
            <li><Link to="/shop?category=medias" className="hover:text-lupo-black transition-colors">Medias</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[11px] uppercase tracking-[1px] text-lupo-black font-semibold mb-6">Support</h4>
          <ul className="space-y-4 text-[13px] text-[#777]">
            <li><Link to="/faq" className="hover:text-lupo-black transition-colors">FAQ</Link></li>
            <li><Link to="/shipping" className="hover:text-lupo-black transition-colors">Envíos y Devoluciones</Link></li>
            <li><Link to="/contact" className="hover:text-lupo-black transition-colors">Contacto</Link></li>
            <li><Link to="/admin" className="hover:text-lupo-black transition-colors">Admin (Importar)</Link></li>
          </ul>
        </div>
      </div>
      
      <div className="px-6 md:px-[60px] pb-10 flex flex-col md:flex-row items-center justify-between text-[11px] text-[#777] uppercase tracking-[1px]">
        <p>&copy; {new Date().getFullYear()} Lupo Store. All rights reserved.</p>
        <div className="flex space-x-6 mt-4 md:mt-0">
          <Link to="/privacy" className="hover:text-lupo-black transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-lupo-black transition-colors">Terms of Service</Link>
        </div>
      </div>
    </footer>
  );
}
