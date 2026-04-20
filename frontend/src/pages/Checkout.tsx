import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import {
  createCheckoutOrder,
  payOrderWithMercadoPagoCard,
  type CheckoutPaymentMethod,
} from '../lib/api';

function paymentLabel(method: CheckoutPaymentMethod): string {
  if (method === 'mercado_pago') return 'Mercado Pago';
  if (method === 'card') return 'Tarjeta (crédito / débito)';
  if (method === 'bank_transfer') return 'Transferencia bancaria';
  return 'Efectivo';
}

function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window !== 'undefined' && window.MercadoPago) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-lupo-mp-sdk="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Mercado Pago SDK.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.dataset.lupoMpSdk = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Mercado Pago SDK.'));
    document.body.appendChild(script);
  });
}

export function Checkout() {
  const { items, cartTotal, clearCart } = useCart();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardFormError, setCardFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState(
    'Gracias por tu compra. Hemos recibido tu orden y te notificaremos cuando sea enviada.'
  );
  const [checkoutFallbackUrl, setCheckoutFallbackUrl] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('mercado_pago');
  const [cardFormReady, setCardFormReady] = useState(false);
  const cardFormRef = useRef<MercadoPagoCardFormInstance | null>(null);
  const mpPublicKey = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY?.trim() || '';

  const paymentTotal = cartTotal;

  const submitEmbeddedCardPayment = async (cardData: ReturnType<MercadoPagoCardFormInstance['getCardFormData']>) => {
    const checkoutForm = document.getElementById('form-checkout') as HTMLFormElement | null;
    if (!checkoutForm) {
      setError('No se encontró el formulario de checkout.');
      return;
    }
    const formData = new FormData(checkoutForm);
    const guestEmail = String(formData.get('email') || '').trim();
    const guestPhone = String(formData.get('phone') || '').trim();
    const firstName = String(formData.get('firstName') || '').trim();
    const lastName = String(formData.get('lastName') || '').trim();
    const address = String(formData.get('address') || '').trim();
    const city = String(formData.get('city') || '').trim();
    const zip = String(formData.get('zip') || '').trim();

    if (!guestEmail || !firstName || !lastName || !address || !city || !zip) {
      setError('Completá los datos de contacto y envío antes de pagar con tarjeta.');
      return;
    }

    const paymentNotes = `Cliente: ${firstName} ${lastName}\nDirección: ${address}, ${city} (${zip})`;

    setError(null);
    setIsSubmitting(true);
    const orderResult = await createCheckoutOrder({
      items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
      guestEmail,
      guestPhone,
      notes: paymentNotes,
      paymentMethod: 'card',
      installments: Number(cardData.installments || '1'),
    });
    if ('error' in orderResult) {
      setIsSubmitting(false);
      setError(orderResult.error);
      return;
    }

    const paymentResult = await payOrderWithMercadoPagoCard({
      orderId: orderResult.orderId,
      token: cardData.token,
      paymentMethodId: cardData.paymentMethodId,
      issuerId: cardData.issuerId || null,
      installments: Number(cardData.installments || '1'),
      payerEmail: cardData.cardholderEmail || guestEmail,
      identificationType: cardData.identificationType || null,
      identificationNumber: cardData.identificationNumber || null,
    });
    setIsSubmitting(false);

    if ('error' in paymentResult) {
      setError(paymentResult.error);
      return;
    }

    if (paymentResult.paymentStatus === 'paid') {
      setSuccessMessage('Pago aprobado. ¡Tu pedido quedó confirmado!');
    } else {
      setSuccessMessage(
        'Recibimos tu pago con tarjeta y está en proceso de validación. Te avisaremos apenas se confirme.'
      );
    }
    setIsSuccess(true);
    clearCart();
  };

  useEffect(() => {
    if (paymentMethod !== 'card') {
      setCardFormReady(false);
      setCardFormError(null);
      cardFormRef.current = null;
      return;
    }
    if (!mpPublicKey) {
      setCardFormError('Falta configurar VITE_MERCADO_PAGO_PUBLIC_KEY en el frontend.');
      return;
    }

    let cancelled = false;
    setCardFormError(null);
    setCardFormReady(false);

    loadMercadoPagoSdk()
      .then(() => {
        if (cancelled) return;
        if (!window.MercadoPago) {
          setCardFormError('Mercado Pago SDK no está disponible.');
          return;
        }
        const mp = new window.MercadoPago(mpPublicKey, { locale: 'es-AR' });
        const cardForm = mp.cardForm({
          amount: String(paymentTotal.toFixed(2)),
          iframe: true,
          form: {
            id: 'form-checkout',
            cardNumber: { id: 'form-checkout__cardNumber', placeholder: 'Número de tarjeta' },
            expirationDate: { id: 'form-checkout__expirationDate', placeholder: 'MM/YY' },
            securityCode: { id: 'form-checkout__securityCode', placeholder: 'CVV' },
            cardholderName: { id: 'form-checkout__cardholderName', placeholder: 'Titular de la tarjeta' },
            issuer: { id: 'form-checkout__issuer', placeholder: 'Banco emisor' },
            installments: { id: 'form-checkout__installments', placeholder: 'Cuotas' },
            identificationType: { id: 'form-checkout__identificationType', placeholder: 'Tipo de documento' },
            identificationNumber: { id: 'form-checkout__identificationNumber', placeholder: 'Número de documento' },
            cardholderEmail: { id: 'form-checkout__cardholderEmail', placeholder: 'Email' },
          },
          callbacks: {
            onFormMounted: (mountError: Error | undefined) => {
              if (mountError) {
                setCardFormError(mountError.message || 'No se pudo montar el formulario de tarjeta.');
                return;
              }
              setCardFormReady(true);
            },
            onSubmit: async (event: Event) => {
              event.preventDefault();
              const data = cardForm.getCardFormData();
              if (!data.token?.trim() || !data.paymentMethodId?.trim()) {
                setError(
                  'Completá los datos de la tarjeta, documento y cuotas. Si el error persiste, verificá VITE_MERCADO_PAGO_PUBLIC_KEY y que uses la misma cuenta (test/producción) que en el backend.'
                );
                return;
              }
              await submitEmbeddedCardPayment(data);
            },
            onError: (mpError: { message?: string }) => {
              setCardFormError(mpError?.message || 'Error en el formulario de tarjeta.');
            },
          },
        });
        cardFormRef.current = cardForm;
      })
      .catch((sdkError: unknown) => {
        if (cancelled) return;
        setCardFormError(sdkError instanceof Error ? sdkError.message : 'No se pudo inicializar Mercado Pago.');
      });

    return () => {
      cancelled = true;
      cardFormRef.current = null;
    };
  }, [paymentMethod, paymentTotal, mpPublicKey]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (paymentMethod === 'card') {
      return;
    }
    const form = e.currentTarget;
    const formData = new FormData(form);

    setError(null);
    setIsSubmitting(true);
    setCheckoutFallbackUrl(null);

    const guestEmail = String(formData.get('email') || '').trim();
    const guestPhone = String(formData.get('phone') || '').trim();
    const firstName = String(formData.get('firstName') || '').trim();
    const lastName = String(formData.get('lastName') || '').trim();
    const address = String(formData.get('address') || '').trim();
    const city = String(formData.get('city') || '').trim();
    const zip = String(formData.get('zip') || '').trim();
    const paymentNotes = `Cliente: ${firstName} ${lastName}\nDirección: ${address}, ${city} (${zip})`;

    const result = await createCheckoutOrder({
      items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
      guestEmail,
      guestPhone,
      notes: paymentNotes,
      paymentMethod,
      installments: 1,
    });

    setIsSubmitting(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }

    if (paymentMethod === 'mercado_pago' && result.checkoutUrl) {
      setCheckoutFallbackUrl(result.checkoutUrl);
      window.location.assign(result.checkoutUrl);
      return;
    }

    if (paymentMethod === 'bank_transfer') {
      setSuccessMessage(
        'Recibimos tu pedido. Te vamos a contactar para enviarte los datos bancarios y confirmar la transferencia.'
      );
    } else if (paymentMethod === 'cash') {
      setSuccessMessage('Recibimos tu pedido para pago en efectivo. Te contactaremos para coordinar la entrega.');
    } else {
      setSuccessMessage(
        `Pago registrado con ${paymentLabel(paymentMethod)}. Te enviaremos la confirmación final por email o WhatsApp.`
      );
    }

    setIsSuccess(true);
    clearCart();
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
            {successMessage}
          </p>
          {checkoutFallbackUrl && (
            <p className="text-[14px] text-lupo-text">
              Si no abrís Mercado Pago automáticamente, podés continuar desde{' '}
              <a className="underline" href={checkoutFallbackUrl}>
                este enlace
              </a>
              .
            </p>
          )}
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
          <form id="form-checkout" onSubmit={handleSubmit} className="space-y-10">
            {/* Contact Info */}
            <section>
              <h2 className="text-[18px] font-medium mb-6 text-lupo-black">Información de Contacto</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Email</label>
                  <input 
                    type="email" 
                    name="email"
                    id="email" 
                    required
                    className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                    placeholder="tu@email.com"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    name="phone"
                    id="phone"
                    className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                    placeholder="+54 9 ..."
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
                    name="firstName"
                    id="firstName" 
                    required
                    className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Apellido</label>
                  <input 
                    type="text" 
                    name="lastName"
                    id="lastName" 
                    required
                    className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="address" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Dirección</label>
                  <input 
                    type="text" 
                    name="address"
                    id="address" 
                    required
                    className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor="city" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Ciudad</label>
                  <input 
                    type="text" 
                    name="city"
                    id="city" 
                    required
                    className="w-full px-4 py-3 bg-white border border-lupo-border focus:outline-none focus:border-lupo-black transition-colors text-[14px]"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor="zip" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Código Postal</label>
                  <input 
                    type="text" 
                    name="zip"
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
                  <p className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Método de pago</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[14px]">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="mercado_pago"
                        checked={paymentMethod === 'mercado_pago'}
                        onChange={() => setPaymentMethod('mercado_pago')}
                      />
                      Mercado Pago
                    </label>
                    <label className="flex items-center gap-2 text-[14px]">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="card"
                        checked={paymentMethod === 'card'}
                        onChange={() => setPaymentMethod('card')}
                      />
                      Tarjeta de crédito o débito
                    </label>
                    <label className="flex items-center gap-2 text-[14px]">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="bank_transfer"
                        checked={paymentMethod === 'bank_transfer'}
                        onChange={() => setPaymentMethod('bank_transfer')}
                      />
                      Transferencia bancaria
                    </label>
                    <label className="flex items-center gap-2 text-[14px]">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cash"
                        checked={paymentMethod === 'cash'}
                        onChange={() => setPaymentMethod('cash')}
                      />
                      Efectivo
                    </label>
                  </div>
                </div>

                {paymentMethod === 'card' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Número de tarjeta
                        </label>
                        <div id="form-checkout__cardNumber" className="w-full px-4 py-3 border border-lupo-border min-h-[46px]" />
                      </div>
                      <div>
                        <label className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Vencimiento
                        </label>
                        <div id="form-checkout__expirationDate" className="w-full px-4 py-3 border border-lupo-border min-h-[46px]" />
                      </div>
                      <div>
                        <label className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Código de seguridad
                        </label>
                        <div id="form-checkout__securityCode" className="w-full px-4 py-3 border border-lupo-border min-h-[46px]" />
                      </div>
                      <div>
                        <label htmlFor="form-checkout__cardholderName" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Titular
                        </label>
                        <input id="form-checkout__cardholderName" className="w-full px-4 py-3 border border-lupo-border text-[14px]" />
                      </div>
                      <div>
                        <label htmlFor="form-checkout__issuer" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Banco emisor
                        </label>
                        <select id="form-checkout__issuer" className="w-full px-4 py-3 border border-lupo-border text-[14px]" />
                      </div>
                      <div>
                        <label htmlFor="form-checkout__installments" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Cuotas
                        </label>
                        <select id="form-checkout__installments" className="w-full px-4 py-3 border border-lupo-border text-[14px]" />
                      </div>
                      <div>
                        <label htmlFor="form-checkout__identificationType" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Tipo de documento
                        </label>
                        <select id="form-checkout__identificationType" className="w-full px-4 py-3 border border-lupo-border text-[14px]" />
                      </div>
                      <div>
                        <label htmlFor="form-checkout__identificationNumber" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Número de documento
                        </label>
                        <input id="form-checkout__identificationNumber" className="w-full px-4 py-3 border border-lupo-border text-[14px]" />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="form-checkout__cardholderEmail" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Email del titular
                        </label>
                        <input id="form-checkout__cardholderEmail" className="w-full px-4 py-3 border border-lupo-border text-[14px]" />
                      </div>
                    </div>
                    <div className="text-[12px] text-lupo-text">
                      Mercado Pago procesa la tarjeta de forma embebida y segura, sin salir de esta página.
                    </div>
                    {!cardFormReady && !cardFormError && (
                      <p className="text-[12px] text-lupo-text">Cargando formulario de tarjeta…</p>
                    )}
                    {cardFormError && <p className="text-[12px] text-red-600">{cardFormError}</p>}
                  </>
                )}

                {paymentMethod === 'bank_transfer' && (
                  <p className="text-[13px] text-lupo-text">
                    Al confirmar, te enviaremos los datos bancarios para completar el pago por transferencia.
                  </p>
                )}

                {paymentMethod === 'cash' && (
                  <p className="text-[13px] text-lupo-text">
                    El pago en efectivo se coordina al momento de entrega o retiro.
                  </p>
                )}

                {paymentMethod === 'mercado_pago' && (
                  <p className="text-[13px] text-lupo-text">
                    Te vamos a redirigir a Mercado Pago para completar el pago de forma segura.
                  </p>
                )}
              </div>
            </section>

            {error && (
              <p className="text-[13px] text-red-600">{error}</p>
            )}

            <button
              id="form-checkout__submit"
              type="submit"
              disabled={isSubmitting || (paymentMethod === 'card' && !cardFormReady)}
              className="w-full bg-lupo-black disabled:opacity-60 text-white px-[40px] py-[18px] uppercase text-[12px] tracking-[2px] font-semibold hover:bg-black/80 transition-colors mt-8"
            >
              {isSubmitting
                ? 'Procesando...'
                : paymentMethod === 'card'
                  ? `Pagar con tarjeta $${paymentTotal.toFixed(2)}`
                  : `Pagar $${paymentTotal.toFixed(2)}`}
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
                  <div>
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
                <span className="font-light text-[24px] text-lupo-black">${paymentTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
