import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  Lock,
  Wallet,
} from 'lucide-react';
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

const PAYMENT_OPTIONS: {
  id: CheckoutPaymentMethod;
  title: string;
  subtitle: string;
  icon: typeof Wallet;
}[] = [
  {
    id: 'mercado_pago',
    title: 'Mercado Pago',
    subtitle: 'Checkout seguro en Mercado Pago',
    icon: Wallet,
  },
  {
    id: 'card',
    title: 'Tarjeta de crédito o débito',
    subtitle: 'Pagá aquí con tarjeta (Mercado Pago)',
    icon: CreditCard,
  },
  {
    id: 'bank_transfer',
    title: 'Transferencia bancaria',
    subtitle: 'Te enviamos los datos CBU/CVU',
    icon: Landmark,
  },
  {
    id: 'cash',
    title: 'Efectivo',
    subtitle: 'Al entregar o retirar',
    icon: Banknote,
  },
];

/** Estilos de iframes según SDK MP (evita alturas desproporcionadas). */
const MP_IFRAME_FIELD_STYLE = {
  height: '44px',
  fontSize: '16px',
} as const;

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

  const unmountCardFormSafely = useCallback(() => {
    const cf = cardFormRef.current;
    if (!cf) return;
    try {
      cf.unmount();
    } catch {
      /* instancia ya desmontada o contenedor ausente */
    }
    cardFormRef.current = null;
  }, []);

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
      unmountCardFormSafely();
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
            cardNumber: {
              id: 'form-checkout__cardNumber',
              placeholder: 'Número de tarjeta',
              style: { ...MP_IFRAME_FIELD_STYLE },
            },
            expirationDate: {
              id: 'form-checkout__expirationDate',
              placeholder: 'MM/YY',
              style: { ...MP_IFRAME_FIELD_STYLE },
            },
            securityCode: {
              id: 'form-checkout__securityCode',
              placeholder: 'CVV',
              style: { ...MP_IFRAME_FIELD_STYLE },
            },
            cardholderName: { id: 'form-checkout__cardholderName', placeholder: 'Titular de la tarjeta' },
            issuer: { id: 'form-checkout__issuer', placeholder: 'Banco emisor' },
            installments: { id: 'form-checkout__installments', placeholder: 'Cuotas' },
            identificationType: { id: 'form-checkout__identificationType', placeholder: 'Tipo de documento' },
            identificationNumber: { id: 'form-checkout__identificationNumber', placeholder: 'Número de documento' },
            cardholderEmail: { id: 'form-checkout__cardholderEmail', placeholder: 'Email' },
          },
          callbacks: {
            onFormMounted: (mountError: Error | undefined) => {
              if (cancelled) return;
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
              if (cancelled) return;
              setCardFormError(mpError?.message || 'Error en el formulario de tarjeta.');
            },
          },
        });
        if (cancelled) {
          try {
            cardForm.unmount();
          } catch {
            /* ignore */
          }
          return;
        }
        cardFormRef.current = cardForm;
      })
      .catch((sdkError: unknown) => {
        if (cancelled) return;
        setCardFormError(sdkError instanceof Error ? sdkError.message : 'No se pudo inicializar Mercado Pago.');
      });

    return () => {
      cancelled = true;
      unmountCardFormSafely();
    };
  }, [paymentMethod, paymentTotal, mpPublicKey, unmountCardFormSafely]);

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

  const inputClass =
    'w-full px-4 py-3 bg-white border border-lupo-border rounded-md text-[14px] outline-none transition-shadow focus:border-lupo-black focus:ring-2 focus:ring-lupo-black/10';

  return (
    <div className="min-h-screen pt-[120px] pb-24 px-6 md:px-[60px] max-w-7xl mx-auto bg-[#fafafa]">
      <h1 className="text-[40px] md:text-[56px] font-light tracking-[-1px] mb-3 text-lupo-black">Checkout</h1>
      <p className="text-[14px] text-lupo-text mb-10 max-w-xl">
        Completá tus datos y elegí cómo querés pagar. El resumen queda fijo al hacer scroll en pantallas grandes.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
        {/* Form */}
        <div className="lg:col-span-7">
          <form id="form-checkout" onSubmit={handleSubmit} className="space-y-8">
            {/* Contact Info */}
            <section className="rounded-2xl border border-lupo-border bg-white p-6 md:p-8 shadow-sm">
              <h2 className="text-[11px] uppercase tracking-[2px] font-semibold text-lupo-muted mb-1">
                Paso 1
              </h2>
              <h3 className="text-[20px] font-medium mb-6 text-lupo-black">Información de contacto</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    required
                    className={inputClass}
                    placeholder="tu@email.com"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    name="phone"
                    id="phone"
                    className={inputClass}
                    placeholder="+54 9 ..."
                  />
                </div>
              </div>
            </section>

            {/* Shipping Info */}
            <section className="rounded-2xl border border-lupo-border bg-white p-6 md:p-8 shadow-sm">
              <h2 className="text-[11px] uppercase tracking-[2px] font-semibold text-lupo-muted mb-1">
                Paso 2
              </h2>
              <h3 className="text-[20px] font-medium mb-6 text-lupo-black">Dirección de envío</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Nombre</label>
                  <input 
                    type="text" 
                    name="firstName"
                    id="firstName" 
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Apellido</label>
                  <input 
                    type="text" 
                    name="lastName"
                    id="lastName" 
                    required
                    className={inputClass}
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="address" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Dirección</label>
                  <input 
                    type="text" 
                    name="address"
                    id="address" 
                    required
                    className={inputClass}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor="city" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Ciudad</label>
                  <input 
                    type="text" 
                    name="city"
                    id="city" 
                    required
                    className={inputClass}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor="zip" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Código Postal</label>
                  <input 
                    type="text" 
                    name="zip"
                    id="zip" 
                    required
                    className={inputClass}
                  />
                </div>
              </div>
            </section>

            {/* Payment Info */}
            <section className="rounded-2xl border border-lupo-border bg-white p-6 md:p-8 shadow-sm">
              <h2 className="text-[11px] uppercase tracking-[2px] font-semibold text-lupo-muted mb-1">
                Paso 3
              </h2>
              <h3 className="text-[20px] font-medium mb-2 text-lupo-black">Método de pago</h3>
              <p className="text-[13px] text-lupo-text mb-6">
                Elegí una opción. Mercado Pago y tarjeta embebida usan la misma cuenta de cobro.
              </p>

              <div className="space-y-3" role="radiogroup" aria-label="Método de pago">
                {PAYMENT_OPTIONS.map(({ id, title, subtitle, icon: Icon }) => {
                  const selected = paymentMethod === id;
                  return (
                    <label
                      key={id}
                      className={`block cursor-pointer rounded-xl border bg-white p-4 transition-all hover:border-[#ccc] ${
                        selected
                          ? 'border-lupo-black bg-[#fafafa] shadow-[inset_0_0_0_1px_#1a1a1a]'
                          : 'border-lupo-border'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={id}
                        checked={selected}
                        onChange={() => setPaymentMethod(id)}
                        className="sr-only"
                      />
                      <div className="flex items-start gap-4">
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            selected ? 'bg-lupo-black text-white' : 'bg-lupo-gray text-lupo-black'
                          }`}
                        >
                          <Icon size={22} strokeWidth={1.5} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 pt-0.5">
                          <span className="block text-[15px] font-medium text-lupo-black">{title}</span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-lupo-text">{subtitle}</span>
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-6 rounded-xl border border-lupo-border bg-lupo-gray/40 p-4 md:p-5">
                {paymentMethod === 'card' && (
                  <>
                    <div className="mb-4 flex items-start gap-2 text-[12px] text-lupo-text">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-lupo-black" aria-hidden />
                      <span>
                        Datos de tarjeta encriptados por Mercado Pago. No almacenamos el número completo en nuestros
                        servidores.
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                      <div className="min-w-0">
                        <label className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Número de tarjeta
                        </label>
                        <div
                          id="form-checkout__cardNumber"
                          className="w-full h-12 rounded-md border border-lupo-border overflow-hidden bg-white [&_iframe]:block [&_iframe]:max-h-12"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Vencimiento
                        </label>
                        <div
                          id="form-checkout__expirationDate"
                          className="w-full h-12 rounded-md border border-lupo-border overflow-hidden bg-white [&_iframe]:block [&_iframe]:max-h-12"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Código de seguridad
                        </label>
                        <div
                          id="form-checkout__securityCode"
                          className="w-full h-12 rounded-md border border-lupo-border overflow-hidden bg-white [&_iframe]:block [&_iframe]:max-h-12"
                        />
                      </div>
                      <div>
                        <label htmlFor="form-checkout__cardholderName" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Titular
                        </label>
                        <input id="form-checkout__cardholderName" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="form-checkout__issuer" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Banco emisor
                        </label>
                        <select id="form-checkout__issuer" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="form-checkout__installments" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Cuotas
                        </label>
                        <select id="form-checkout__installments" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="form-checkout__identificationType" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Tipo de documento
                        </label>
                        <select id="form-checkout__identificationType" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="form-checkout__identificationNumber" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Número de documento
                        </label>
                        <input id="form-checkout__identificationNumber" className={inputClass} />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="form-checkout__cardholderEmail" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">
                          Email del titular
                        </label>
                        <input id="form-checkout__cardholderEmail" className={inputClass} />
                      </div>
                    </div>
                    {!cardFormReady && !cardFormError && (
                      <p className="mt-4 flex items-center gap-2 text-[13px] text-lupo-text">
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                        Preparando campos seguros…
                      </p>
                    )}
                    {cardFormError && (
                      <p className="mt-4 text-[13px] text-red-600 rounded-md bg-red-50 px-3 py-2 border border-red-100">
                        {cardFormError}
                      </p>
                    )}
                  </>
                )}

                {paymentMethod === 'bank_transfer' && (
                  <p className="text-[14px] leading-relaxed text-lupo-text">
                    Al confirmar el pedido, te enviamos por email o WhatsApp los datos para transferir (CBU/CVU o alias).
                  </p>
                )}

                {paymentMethod === 'cash' && (
                  <p className="text-[14px] leading-relaxed text-lupo-text">
                    Coordinamos el pago en efectivo al momento de la entrega o cuando retires el pedido.
                  </p>
                )}

                {paymentMethod === 'mercado_pago' && (
                  <p className="text-[14px] leading-relaxed text-lupo-text">
                    Vas a salir un momento al sitio de Mercado Pago para autorizar el pago con tu cuenta o tarjeta, de
                    forma segura.
                  </p>
                )}
              </div>
            </section>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>
            )}

            <button
              id="form-checkout__submit"
              type="submit"
              disabled={isSubmitting || (paymentMethod === 'card' && !cardFormReady)}
              className="group flex w-full items-center justify-center gap-2 rounded-md bg-lupo-black px-8 py-[18px] text-[12px] font-semibold uppercase tracking-[2px] text-white shadow-sm transition-all hover:bg-black/85 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Procesando…
                </>
              ) : paymentMethod === 'card' ? (
                `Pagar con tarjeta · $${paymentTotal.toFixed(2)}`
              ) : (
                `Confirmar y pagar · $${paymentTotal.toFixed(2)}`
              )}
            </button>
          </form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-5 lg:self-start">
          <div className="sticky top-28 rounded-2xl border border-lupo-border bg-white p-6 md:p-8 shadow-md">
            <h2 className="text-[11px] uppercase tracking-[2px] font-semibold text-lupo-muted mb-1">Tu pedido</h2>
            <p className="text-[20px] font-medium text-lupo-black mb-6">Resumen</p>

            <ul className="space-y-4 mb-6">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-4 rounded-lg border border-lupo-border/80 bg-lupo-gray/30 p-3"
                >
                  <div className="h-20 w-16 shrink-0 overflow-hidden rounded-md border border-lupo-border bg-[#eee]">
                    <img src={item.image} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 font-medium text-[13px] text-lupo-black">{item.name}</h3>
                    <p className="mt-1 text-[11px] text-lupo-muted">Cantidad · {item.quantity}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[13px] font-semibold tabular-nums text-lupo-black">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-3 border-t border-lupo-border pt-6">
              <div className="flex justify-between text-[13px]">
                <span className="text-lupo-text">Subtotal</span>
                <span className="font-medium tabular-nums text-lupo-black">${cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-lupo-text">Envío</span>
                <span className="font-medium text-[#2E7D32]">Gratis</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-lupo-text">Impuestos</span>
                <span className="font-medium tabular-nums text-lupo-black">$0.00</span>
              </div>

              <div className="flex items-baseline justify-between border-t border-lupo-border pt-4">
                <span className="text-[15px] font-semibold text-lupo-black">Total</span>
                <span className="font-light tabular-nums text-[28px] tracking-tight text-lupo-black">
                  ${paymentTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
