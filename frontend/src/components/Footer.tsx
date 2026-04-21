import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';

export function Footer() {
  return (
    <footer className="bg-[#0E1525] text-white border-t border-[#1F2A44] mt-14">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6 md:p-10 border-b border-[#263250]">
        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] uppercase tracking-[1px] text-lupo-ice font-semibold m-0">Pagos Flexibles</h3>
          <p className="text-[13px] text-[#aeb8ce] m-0 leading-[1.4]">6 cuotas sin interés con tarjetas bancarias.</p>
          <div className="flex gap-2.5 mt-2.5">
            <div className="w-9 h-[22px] bg-[#243454] rounded-[3px]" />
            <div className="w-9 h-[22px] bg-[#243454] rounded-[3px]" />
            <div className="w-9 h-[22px] bg-[#243454] rounded-[3px]" />
            <div className="w-9 h-[22px] bg-[#243454] rounded-[3px]" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] uppercase tracking-[1px] text-lupo-ice font-semibold m-0">Logística Inteligente</h3>
          <p className="text-[13px] text-[#aeb8ce] m-0 leading-[1.4]">Envíos rápidos a todo el país con seguimiento.</p>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] uppercase tracking-[1px] text-lupo-ice font-semibold m-0">Atención Personalizada</h3>
          <p className="text-[13px] text-[#aeb8ce] m-0 leading-[1.4]">Soporte por email y WhatsApp para cada compra.</p>
        </div>
      </div>

      <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="md:col-span-2">
          <BrandLogo to="/" className="max-h-12 brightness-0 invert opacity-95" />
          <p className="text-[#aeb8ce] max-w-sm text-[13px] leading-[1.6] mt-5">
            Diseño funcional y calidad premium para el día a día. Hecho para moverte con comodidad.
          </p>
        </div>
        
        <div>
          <h4 className="text-[11px] uppercase tracking-[1px] text-lupo-ice font-semibold mb-6">Shop</h4>
          <ul className="space-y-4 text-[13px] text-[#aeb8ce]">
            <li><Link to="/shop" className="hover:text-lupo-sky">Todos los productos</Link></li>
            <li><Link to="/shop?category=hombre" className="hover:text-lupo-sky">Hombre</Link></li>
            <li><Link to="/shop?category=damas" className="hover:text-lupo-sky">Damas</Link></li>
            <li><Link to="/shop?category=deportivo" className="hover:text-lupo-sky">Deportivo</Link></li>
            <li><Link to="/shop?category=medias" className="hover:text-lupo-sky">Medias</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[11px] uppercase tracking-[1px] text-lupo-ice font-semibold mb-6">Soporte</h4>
          <ul className="space-y-4 text-[13px] text-[#aeb8ce]">
            <li><Link to="/shop" className="hover:text-lupo-sky">Guía de talles</Link></li>
            <li><Link to="/shop" className="hover:text-lupo-sky">Envíos y devoluciones</Link></li>
            <li><Link to="/shop" className="hover:text-lupo-sky">Contacto</Link></li>
            <li><Link to="/admin" className="hover:text-lupo-sky">Admin</Link></li>
          </ul>
        </div>
      </div>
      
      <div className="px-6 md:px-10 pb-10 flex flex-col md:flex-row items-center justify-between text-[11px] text-[#95a3c1] uppercase tracking-[1px]">
        <p>&copy; {new Date().getFullYear()} Lupo Store. Todos los derechos reservados.</p>
        <div className="flex space-x-6 mt-4 md:mt-0">
          <Link to="/shop" className="hover:text-lupo-sky">Privacidad</Link>
          <Link to="/shop" className="hover:text-lupo-sky">Términos</Link>
        </div>
      </div>
    </footer>
  );
}
