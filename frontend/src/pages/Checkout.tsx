import { useState, type FormEvent } from 'react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

export function Checkout() {
  const { items, cartTotal, clearCart } = useCart();
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Simulate payment processing
    setTimeout(() => {
      setIsSuccess(true);
      clearCart();
    }, 1500);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen pt-[120px] pb-24 px-6 flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center text-[#2E7D32] mb-6">
            <CheckCircle2 size={80} strokeWidth={1} />
          </div>
          <h1 className="text-[40px] font-light tracking-[-1px]">Orden Confirmada</h1>
          <p className="text-[16px] text-lupo-text leading-[1.6]">
            Gracias por tu compra. Hemos recibido tu orden y te notificaremos cuando sea enviada.
          </p>
          <div className="pt-8">
            <Link 
              to="/" 
              className="inline-flex justify-center w-full bg-lupo-black text-white px-[40px] py-[18px] uppercase text-[12px] tracking-[2px] font-semibold hover:bg-black/80 transition-colors"
            >
              Volver al Inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen pt-[120px] pb-24 px-6 flex flex-col items-center justify-center text-center">
        <h1 className="text-[40px] font-light tracking-[-1px] mb-4">Tu carrito está vacío</h1>
        <p className="text-[16px] text-lupo-text mb-8">Parece que aún no has agregado nada a tu carrito.</p>
        <Link 
          to="/shop" 
          className="inline-flex justify-center bg-lupo-black text-white px-[40px] py-[18px] uppercase text-[12px] tracking-[2px] font-semibold hover:bg-black/80 transition-colors"
        >
          Continuar Comprando
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-[120px] pb-24 px-6 md:px-[60px] max-w-7xl mx-auto">
      <h1 className="text-[40px] md:text-[56px] font-light tracking-[-1px] mb-12">Checkout</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
        {/* Form */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Contact Info */}
            <section>
              <h2 className="text-[18px] font-medium mb-6 text-lupo-black">Información de Contacto</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Email</label>
                  <input 
                    type="email" 
                    id="email" 
                    required
                    className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>
            </section>

            {/* Shipping Info */}
            <section>
              <h2 className="text-[18px] font-medium mb-6 text-lupo-black">Dirección de Envío</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Nombre</label>
                  <input 
                    type="text" 
                    id="firstName" 
                    required
                    className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Apellido</label>
                  <input 
                    type="text" 
                    id="lastName" 
                    required
                    className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="address" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Dirección</label>
                  <input 
                    type="text" 
                    id="address" 
                    required
                    className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor="city" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Ciudad</label>
                  <input 
                    type="text" 
                    id="city" 
                    required
                    className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor="zip" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Código Postal</label>
                  <input 
                    type="text" 
                    id="zip" 
                    required
                    className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                  />
                </div>
              </div>
            </section>

            {/* Payment Info */}
            <section>
              <h2 className="text-[18px] font-medium mb-6 text-lupo-black">Pago</h2>
              <div className="bg-white p-6 border border-lupo-border space-y-4">
                <div>
                  <label htmlFor="cardName" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Nombre en la tarjeta</label>
                  <input 
                    type="text" 
                    id="cardName" 
                    required
                    className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                  />
                </div>
                <div>
                  <label htmlFor="cardNumber" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Número de tarjeta</label>
                  <input 
                    type="text" 
                    id="cardNumber" 
                    placeholder="0000 0000 0000 0000"
                    required
                    className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="exp" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Vencimiento</label>
                    <input 
                      type="text" 
                      id="exp" 
                      placeholder="MM/YY"
                      required
                      className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                    />
                  </div>
                  <div>
                    <label htmlFor="cvc" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">CVC</label>
                    <input 
                      type="text" 
                      id="cvc" 
                      placeholder="123"
                      required
                      className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                    />
                  </div>
                </div>
              </div>
            </section>

            <button 
              type="submit"
              className="w-full bg-lupo-black text-white px-[40px] py-[18px] uppercase text-[12px] tracking-[2px] font-semibold hover:bg-black/80 transition-colors mt-8"
            >
              Pagar ${cartTotal.toFixed(2)}
            </button>
          </form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-lupo-border p-8 sticky top-[120px]">
            <h2 className="text-[18px] font-medium mb-6 text-lupo-black">Resumen de Orden</h2>
            
            <div className="space-y-4 mb-6">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="w-16 h-20 bg-[#F0F0F0] border border-[#EEE] overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-[13px] text-lupo-black">{item.name}</h3>
                    <p className="text-[11px] text-[#777] mt-1">Cant: {item.quantity}</p>
                  </div>
                  <div className="font-medium text-[13px] text-lupo-black">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="border-t border-lupo-border pt-6 space-y-4">
              <div className="flex justify-between text-[13px]">
                <span className="text-lupo-text">Subtotal</span>
                <span className="font-medium text-lupo-black">${cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-lupo-text">Envío</span>
                <span className="text-[#2E7D32] font-medium">Gratis</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-lupo-text">Impuestos</span>
                <span className="font-medium text-lupo-black">$0.00</span>
              </div>
              
              <div className="border-t border-lupo-border pt-4 flex justify-between items-center">
                <span className="font-medium text-[16px] text-lupo-black">Total</span>
                <span className="font-light text-[24px] text-lupo-black">${cartTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
