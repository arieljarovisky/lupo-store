import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';

export function CartDrawer() {
  const { isCartOpen, setIsCartOpen, items, updateQuantity, removeFromCart, cartTotal } = useCart();

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCartOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col border-l border-[#d9e1f1]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#d9e1f1] bg-[#f5f8ff]">
              <h2 className="text-[18px] font-medium text-lupo-ink">Tu Carrito</h2>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-2 hover:bg-gray-50 transition-colors text-lupo-black"
              >
                <X size={20} />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#9eabc7] space-y-4">
                  <ShoppingBag size={48} strokeWidth={1} />
                  <p className="text-[14px] italic">Tu carrito está vacío</p>
                  <button 
                    onClick={() => setIsCartOpen(false)}
                    className="mt-4 text-lupo-ink border-b border-lupo-ink pb-1 text-[12px] uppercase tracking-[1.5px] font-semibold not-italic"
                  >
                    Continuar Comprando
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-24 h-32 bg-[#edf2fc] border border-[#d9e1f1] overflow-hidden flex-shrink-0 rounded-lg">
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="font-medium text-[13px] text-lupo-ink">{item.name}</h3>
                            <button 
                              onClick={() => removeFromCart(item.id)}
                              className="text-[#888] hover:text-lupo-black transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <p className="text-[13px] text-lupo-slate mt-1">${item.price.toFixed(2)}</p>
                        </div>
                        
                        <div className="flex items-center border border-[#d9e1f1] w-fit rounded-md">
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-2 hover:bg-gray-50 transition-colors text-lupo-black"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center text-[13px] font-medium text-lupo-black">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="p-2 hover:bg-gray-50 transition-colors text-lupo-black"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-6 border-t border-[#d9e1f1] bg-white">
                <div className="flex justify-between items-center mb-6">
                  <span className="font-medium text-[14px] text-lupo-black">Subtotal</span>
                  <span className="font-light text-[24px] text-lupo-black">${cartTotal.toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-[#777] mb-6">Envío e impuestos calculados en el checkout.</p>
                <Link
                  to="/checkout"
                  onClick={() => setIsCartOpen(false)}
                  className="w-full bg-lupo-night text-white px-[40px] py-[18px] uppercase text-[12px] tracking-[2px] font-semibold hover:opacity-90 transition-colors flex items-center justify-center rounded-xl"
                >
                  Checkout
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
