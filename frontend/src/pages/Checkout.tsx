import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useCart } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
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
  fetchMicorreoAgencies,
  payOrderWithMercadoPagoCard,
  quoteCheckoutShipping,
  type CheckoutPaymentMethod,
  type CheckoutShippingEngine,
  type CheckoutShippingQuoteOption,
  type MicorreoAgencyOption,
} from '../lib/api';

/** Letra de provincia según CPA (Correo / MiCorreo). */
const AR_CPA_PROVINCES: { code: string; name: string }[] = [
  { code: 'C', name: 'Ciudad Autónoma de Buenos Aires' },
  { code: 'B', name: 'Buenos Aires' },
  { code: 'K', name: 'Catamarca' },
  { code: 'H', name: 'Chaco' },
  { code: 'U', name: 'Chubut' },
  { code: 'X', name: 'Córdoba' },
  { code: 'W', name: 'Corrientes' },
  { code: 'E', name: 'Entre Ríos' },
  { code: 'P', name: 'Formosa' },
  { code: 'Y', name: 'Jujuy' },
  { code: 'L', name: 'La Pampa' },
  { code: 'F', name: 'La Rioja' },
  { code: 'M', name: 'Mendoza' },
  { code: 'N', name: 'Misiones' },
  { code: 'Q', name: 'Neuquén' },
  { code: 'R', name: 'Río Negro' },
  { code: 'A', name: 'Salta' },
  { code: 'J', name: 'San Juan' },
  { code: 'D', name: 'San Luis' },
  { code: 'Z', name: 'Santa Cruz' },
  { code: 'S', name: 'Santa Fe' },
  { code: 'G', name: 'Santiago del Estero' },
  { code: 'V', name: 'Tierra del Fuego' },
  { code: 'T', name: 'Tucumán' },
];

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

/** Monto estable para CardForm (MP es sensible a decimales raros). */
function mercadoPagoAmountString(total: number): string {
  const n = Math.round(Math.max(0, total) * 100) / 100;
  return n.toFixed(2);
}

/** El SDK suele mandar `onError` como arreglo `{ message }[]`, no un solo `message`. */
function messageFromMercadoPagoError(err: unknown): string {
  if (err == null) return '';
  if (Array.isArray(err)) {
    return err
      .map((e) =>
        e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message ?? '') : ''
      )
      .filter(Boolean)
      .join(' · ');
  }
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && 'message' in err) return String((err as { message?: unknown }).message ?? '');
  return String(err);
}

/** Mensaje técnico del SDK → texto útil para el usuario. */
function friendlyMercadoPagoFormError(raw: string): string {
  const t = raw.trim();
  if (/payer_costs|Cannot destructure|get_installments/i.test(t)) {
    return (
      'No se pudieron cargar las cuotas en este momento. Lo más habitual es un total de pedido demasiado bajo: Mercado Pago a veces no devuelve planes de cuotas si el monto no alcanza un mínimo. ' +
      'Probá sumando más productos o con un total mayor; también podés usar solo redirección a Mercado Pago u otra tarjeta. ' +
      'Si persiste, comprobá que la clave pública (frontend) y el token (backend) sean ambos de prueba o ambos de producción. ' +
      'Detalle técnico: ' +
      t
    );
  }
  return t;
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
  const { customer } = useCustomerAuth();
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
  const [issuerDisplayName, setIssuerDisplayName] = useState('Banco emisor');
  const [shippingZipcode, setShippingZipcode] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingProvince, setShippingProvince] = useState('');
  const [shippingDeliveredType, setShippingDeliveredType] = useState<'D' | 'S'>('D');
  const [shippingProvinceCodePickup, setShippingProvinceCodePickup] = useState('');
  const [shippingEngine, setShippingEngine] = useState<CheckoutShippingEngine | null>(null);
  const [agencies, setAgencies] = useState<MicorreoAgencyOption[]>([]);
  const [agenciesLoading, setAgenciesLoading] = useState(false);
  const [agenciesError, setAgenciesError] = useState<string | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<MicorreoAgencyOption | null>(null);
  const [shippingOptions, setShippingOptions] = useState<CheckoutShippingQuoteOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null);
  const cardFormRef = useRef<MercadoPagoCardFormInstance | null>(null);
  useEffect(() => {
    if (!customer) return;
    const emailInput = document.getElementById('email') as HTMLInputElement | null;
    const firstNameInput = document.getElementById('firstName') as HTMLInputElement | null;
    const lastNameInput = document.getElementById('lastName') as HTMLInputElement | null;
    if (emailInput && customer.email && !emailInput.value.trim()) emailInput.value = customer.email;
    if ((firstNameInput || lastNameInput) && customer.fullName) {
      const parts = customer.fullName.trim().split(/\s+/);
      const first = parts.shift() || '';
      const rest = parts.join(' ');
      if (firstNameInput && !firstNameInput.value.trim()) firstNameInput.value = first;
      if (lastNameInput && !lastNameInput.value.trim()) lastNameInput.value = rest || '-';
    }
  }, [customer]);

  const mpPublicKey = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY?.trim() || '';

  const selectedShipping =
    shippingOptions.find((option) => option.id === selectedShippingId) ?? shippingOptions[0] ?? null;
  const shippingCost = selectedShipping?.cost ?? 0;
  const paymentTotal = cartTotal + shippingCost;

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
    if (!selectedShipping) {
      setError('Completá ciudad y código postal para calcular y elegir un envío antes de pagar.');
      return;
    }
    if (shippingEngine === 'micorreo' && shippingDeliveredType === 'S') {
      if (!shippingProvinceCodePickup.trim()) {
        setError('Elegí la provincia de la sucursal donde vas a retirar el pedido.');
        return;
      }
      if (!selectedAgency) {
        setError('Elegí la sucursal de Correo Argentino para el retiro.');
        return;
      }
    }

    const pickupLine =
      shippingEngine === 'micorreo' && shippingDeliveredType === 'S' && selectedAgency
        ? `\nRetiro en sucursal: ${selectedAgency.name} (${selectedAgency.code}) — ${[selectedAgency.street, selectedAgency.locality, selectedAgency.postalCode].filter(Boolean).join(', ')}`
        : '';
    const paymentNotes = `Cliente: ${firstName} ${lastName}\nDirección: ${address}, ${city} (${zip})${pickupLine}`;

    setError(null);
    setIsSubmitting(true);
    const orderResult = await createCheckoutOrder({
      items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
      guestEmail,
      guestPhone,
      notes: paymentNotes,
      paymentMethod: 'card',
      installments: Number(cardData.installments || '1'),
      shippingCost: selectedShipping.cost,
      shippingLabel: selectedShipping.label,
      shippingOptionId: selectedShipping.id,
      shippingProvider: selectedShipping.provider,
      shippingZipcode: zip,
      shippingAgencyCode:
        shippingEngine === 'micorreo' && shippingDeliveredType === 'S' && selectedAgency
          ? selectedAgency.code
          : undefined,
      shippingAgencyName:
        shippingEngine === 'micorreo' && shippingDeliveredType === 'S' && selectedAgency
          ? [selectedAgency.name, selectedAgency.locality].filter(Boolean).join(' — ')
          : undefined,
      shippingDeliveredType: shippingEngine === 'micorreo' ? shippingDeliveredType : undefined,
      shippingProductType: selectedShipping.productType ?? undefined,
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
      setIssuerDisplayName('Banco emisor');
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
          amount: mercadoPagoAmountString(paymentTotal),
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
            issuer: { id: 'form-checkout__issuerHidden', placeholder: 'Banco emisor' },
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
                  'Faltan datos obligatorios del pago con tarjeta: revisá número, vencimiento, CVV, titular, documento, email y que elijas un plan en Cuotas (o un monto mayor si la lista no cargó). Verificá también que la clave pública de Mercado Pago en el sitio coincida con test o producción según el backend.'
                );
                return;
              }
              await submitEmbeddedCardPayment(data);
            },
            onError: (mpError: unknown) => {
              if (cancelled) return;
              const raw = messageFromMercadoPagoError(mpError);
              setCardFormError(
                raw ? friendlyMercadoPagoFormError(raw) : 'Error en el formulario de tarjeta.'
              );
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

  /** MP usa email/DNI del titular para cuotas y antifraude; copiamos el email del checkout si el campo MP sigue vacío. */
  useEffect(() => {
    if (paymentMethod !== 'card' || !cardFormReady) return;
    const main = document.getElementById('email') as HTMLInputElement | null;
    const holder = document.getElementById('form-checkout__cardholderEmail') as HTMLInputElement | null;
    const mainEmail = main?.value?.trim();
    if (!mainEmail || !holder || holder.value.trim()) return;
    holder.value = mainEmail;
    holder.dispatchEvent(new Event('input', { bubbles: true }));
    holder.dispatchEvent(new Event('change', { bubbles: true }));
  }, [paymentMethod, cardFormReady]);

  useEffect(() => {
    if (paymentMethod !== 'card' || !cardFormReady) return;
    const issuer = document.getElementById('form-checkout__issuerHidden') as HTMLSelectElement | null;
    if (!issuer) return;

    const syncIssuerName = () => {
      const option = issuer.selectedOptions?.[0];
      const name = option?.textContent?.trim() || '';
      setIssuerDisplayName(name || 'Banco emisor');
    };

    const observer = new MutationObserver(syncIssuerName);
    observer.observe(issuer, { attributes: true, childList: true, subtree: true });
    issuer.addEventListener('change', syncIssuerName);
    syncIssuerName();

    return () => {
      observer.disconnect();
      issuer.removeEventListener('change', syncIssuerName);
    };
  }, [paymentMethod, cardFormReady]);

  useEffect(() => {
    const zipcode = shippingZipcode.trim();
    const city = shippingCity.trim();
    if (items.length === 0 || zipcode.length < 4 || city.length < 2) {
      setShippingOptions([]);
      setSelectedShippingId(null);
      setShippingLoading(false);
      setShippingError(null);
      setShippingEngine(null);
      return;
    }

    let cancelled = false;
    setShippingLoading(true);
    setShippingError(null);

    const timer = window.setTimeout(async () => {
      const r = await quoteCheckoutShipping({
        items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
        deliveredType: shippingDeliveredType,
        address: {
          zipcode,
          city,
          province: shippingProvince.trim() || undefined,
          country: 'AR',
        },
      });
      if (cancelled) return;
      setShippingLoading(false);
      if ('error' in r) {
        setShippingOptions([]);
        setSelectedShippingId(null);
        setShippingEngine(null);
        setShippingError(r.error);
        return;
      }
      setShippingEngine(r.shippingEngine);
      setShippingOptions(r.options);
      setSelectedShippingId((prev) => (prev && r.options.some((o) => o.id === prev) ? prev : (r.options[0]?.id ?? null)));
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [items, shippingZipcode, shippingCity, shippingProvince, shippingDeliveredType]);

  useEffect(() => {
    if (shippingEngine !== 'micorreo' || shippingDeliveredType !== 'S') {
      setAgencies([]);
      setAgenciesError(null);
      setAgenciesLoading(false);
      setSelectedAgency(null);
      return;
    }
    const pc = shippingProvinceCodePickup.trim().toUpperCase();
    if (!pc) {
      setAgencies([]);
      setSelectedAgency(null);
      setAgenciesError(null);
      setAgenciesLoading(false);
      return;
    }

    let cancelled = false;
    setAgenciesLoading(true);
    setAgenciesError(null);

    const t = window.setTimeout(async () => {
      const r = await fetchMicorreoAgencies(pc);
      if (cancelled) return;
      setAgenciesLoading(false);
      if (r.ok === false) {
        setAgencies([]);
        setSelectedAgency(null);
        setAgenciesError(r.error);
        return;
      }
      setAgencies(r.agencies);
      setSelectedAgency((prev) => {
        if (prev && r.agencies.some((a) => a.code === prev.code)) return prev;
        return null;
      });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [shippingEngine, shippingDeliveredType, shippingProvinceCodePickup]);

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
    if (!selectedShipping) {
      setIsSubmitting(false);
      setError('Completá ciudad y código postal para calcular y elegir un envío antes de confirmar.');
      return;
    }
    if (shippingEngine === 'micorreo' && shippingDeliveredType === 'S') {
      if (!shippingProvinceCodePickup.trim()) {
        setIsSubmitting(false);
        setError('Elegí la provincia de la sucursal donde vas a retirar el pedido.');
        return;
      }
      if (!selectedAgency) {
        setIsSubmitting(false);
        setError('Elegí la sucursal de Correo Argentino para el retiro.');
        return;
      }
    }
    const pickupLine =
      shippingEngine === 'micorreo' && shippingDeliveredType === 'S' && selectedAgency
        ? `\nRetiro en sucursal: ${selectedAgency.name} (${selectedAgency.code}) — ${[selectedAgency.street, selectedAgency.locality, selectedAgency.postalCode].filter(Boolean).join(', ')}`
        : '';
    const paymentNotes = `Cliente: ${firstName} ${lastName}\nDirección: ${address}, ${city} (${zip})${pickupLine}`;

    const result = await createCheckoutOrder({
      items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
      guestEmail,
      guestPhone,
      notes: paymentNotes,
      paymentMethod,
      installments: 1,
      shippingCost: selectedShipping.cost,
      shippingLabel: selectedShipping.label,
      shippingOptionId: selectedShipping.id,
      shippingProvider: selectedShipping.provider,
      shippingZipcode: zip,
      shippingAgencyCode:
        shippingEngine === 'micorreo' && shippingDeliveredType === 'S' && selectedAgency
          ? selectedAgency.code
          : undefined,
      shippingAgencyName:
        shippingEngine === 'micorreo' && shippingDeliveredType === 'S' && selectedAgency
          ? [selectedAgency.name, selectedAgency.locality].filter(Boolean).join(' — ')
          : undefined,
      shippingDeliveredType: shippingEngine === 'micorreo' ? shippingDeliveredType : undefined,
      shippingProductType: selectedShipping.productType ?? undefined,
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

  /** Altura alineada con iframes MP (h-12) y fondo blanco uniforme (evita contraste con autofill azul). */
  const inputClass =
    'w-full h-12 px-4 py-0 bg-white border border-lupo-border rounded-md text-[14px] leading-normal outline-none transition-shadow focus:border-lupo-black focus:ring-2 focus:ring-lupo-black/10 ' +
    '[color-scheme:light] [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#fff] [&:-webkit-autofill]:[-webkit-text-fill-color:#1a1a1a]';

  const mpIframeClass =
    'w-full h-12 rounded-md border border-lupo-border bg-white overflow-hidden [&_iframe]:block [&_iframe]:h-12 [&_iframe]:max-h-12 [&_iframe]:w-full';

  return (
    <div className="min-h-screen bg-[#fafaf8] pt-[120px] pb-24 px-4 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <h1 className="text-[40px] md:text-[56px] font-light tracking-[-1px] mb-3 text-lupo-black">Checkout</h1>
      <p className="text-[14px] text-lupo-text mb-10 max-w-xl">
        Completá tus datos y elegí cómo querés pagar. El resumen queda fijo al hacer scroll en pantallas grandes.
      </p>
      {customer && (
        <div className="mb-6 rounded-xl border border-[#d9e1f1] bg-white px-4 py-3 text-[13px] text-lupo-ink">
          Sesión iniciada como <strong>{customer.fullName || customer.email || `Cliente #${customer.id}`}</strong>.
          Tus datos se autocompletan para acelerar el checkout.
        </div>
      )}

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
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
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
                    value={shippingZipcode}
                    onChange={(e) => setShippingZipcode(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="province" className="block text-[11px] uppercase tracking-[1px] font-semibold text-lupo-black mb-2">Provincia (opcional)</label>
                  <input
                    type="text"
                    name="province"
                    id="province"
                    className={inputClass}
                    value={shippingProvince}
                    onChange={(e) => setShippingProvince(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-lupo-border bg-white p-6 md:p-8 shadow-sm">
              <h2 className="text-[11px] uppercase tracking-[2px] font-semibold text-lupo-muted mb-1">
                Paso 2.5
              </h2>
              <h3 className="text-[20px] font-medium mb-2 text-lupo-black">Envío</h3>
              <p className="text-[13px] text-lupo-text mb-5">
                {shippingEngine === 'micorreo'
                  ? 'Cotización con la API oficial MiCorreo de Correo Argentino según tu código postal, tipo de entrega y sucursal si retirás.'
                  : 'Calculamos opciones de envío según tu dirección (modo local si MiCorreo no está configurado en el servidor).'}
              </p>

              {shippingEngine === 'micorreo' && (
                <div className="mb-5 space-y-4 rounded-xl border border-lupo-border bg-lupo-gray/30 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[1px] text-lupo-black">
                    Tipo de entrega
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] ${
                        shippingDeliveredType === 'D'
                          ? 'border-lupo-black bg-white'
                          : 'border-lupo-border bg-white/80 hover:border-[#ccc]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveredType"
                        className="accent-lupo-black"
                        checked={shippingDeliveredType === 'D'}
                        onChange={() => {
                          setShippingDeliveredType('D');
                          setSelectedAgency(null);
                        }}
                      />
                      Entrega a domicilio
                    </label>
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] ${
                        shippingDeliveredType === 'S'
                          ? 'border-lupo-black bg-white'
                          : 'border-lupo-border bg-white/80 hover:border-[#ccc]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveredType"
                        className="accent-lupo-black"
                        checked={shippingDeliveredType === 'S'}
                        onChange={() => setShippingDeliveredType('S')}
                      />
                      Retiro en sucursal / depósito
                    </label>
                  </div>

                  {shippingDeliveredType === 'S' && (
                    <div className="space-y-3 border-t border-lupo-border pt-4">
                      <div>
                        <label
                          htmlFor="provincePickup"
                          className="mb-2 block text-[11px] font-semibold uppercase tracking-[1px] text-lupo-black"
                        >
                          Provincia de la sucursal (letra CPA)
                        </label>
                        <select
                          id="provincePickup"
                          className={inputClass}
                          value={shippingProvinceCodePickup}
                          onChange={(e) => {
                            setShippingProvinceCodePickup(e.target.value);
                            setSelectedAgency(null);
                          }}
                        >
                          <option value="">Elegí provincia…</option>
                          {AR_CPA_PROVINCES.map((p) => (
                            <option key={p.code} value={p.code}>
                              {p.code} — {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {agenciesLoading ? (
                        <div className="flex items-center gap-2 text-[13px] text-lupo-text">
                          <Loader2 size={16} className="animate-spin" />
                          Cargando sucursales…
                        </div>
                      ) : agenciesError ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                          {agenciesError}
                        </div>
                      ) : agencies.length > 0 ? (
                        <div>
                          <label
                            htmlFor="agencyPickup"
                            className="mb-2 block text-[11px] font-semibold uppercase tracking-[1px] text-lupo-black"
                          >
                            Sucursal
                          </label>
                          <select
                            id="agencyPickup"
                            className={inputClass}
                            value={selectedAgency?.code ?? ''}
                            onChange={(e) => {
                              const code = e.target.value;
                              setSelectedAgency(agencies.find((a) => a.code === code) ?? null);
                            }}
                          >
                            <option value="">Elegí sucursal…</option>
                            {agencies.map((a) => (
                              <option key={a.code} value={a.code}>
                                {a.name} — {a.locality}
                                {a.postalCode ? ` (${a.postalCode})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : shippingProvinceCodePickup ? (
                        <p className="text-[12px] text-lupo-text">No hay sucursales listadas para esa provincia.</p>
                      ) : (
                        <p className="text-[12px] text-lupo-text">
                          Elegí la provincia para ver las sucursales donde podés retirar.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {shippingZipcode.trim().length < 4 || shippingCity.trim().length < 2 ? (
                <div className="rounded-lg border border-lupo-border bg-lupo-gray/40 px-4 py-3 text-[13px] text-lupo-text">
                  Completá ciudad y código postal para calcular el costo de envío.
                </div>
              ) : shippingLoading ? (
                <div className="flex items-center gap-2 rounded-lg border border-lupo-border bg-lupo-gray/40 px-4 py-3 text-[13px] text-lupo-text">
                  <Loader2 size={16} className="animate-spin" />
                  Calculando opciones de envío…
                </div>
              ) : shippingError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                  {shippingError}
                </div>
              ) : shippingOptions.length === 0 ? (
                <div className="rounded-lg border border-lupo-border bg-lupo-gray/40 px-4 py-3 text-[13px] text-lupo-text">
                  No hay opciones disponibles para esa dirección.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {shippingOptions.map((option) => {
                    const active = selectedShipping?.id === option.id;
                    return (
                      <label
                        key={option.id}
                        className={`block cursor-pointer rounded-xl border px-4 py-3 transition-colors ${
                          active ? 'border-lupo-black bg-[#fafafa]' : 'border-lupo-border bg-white hover:border-[#cfcfcf]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="shippingOption"
                          className="sr-only"
                          checked={active}
                          onChange={() => setSelectedShippingId(option.id)}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[14px] text-lupo-black">{option.label}</span>
                          <span className="font-medium text-[14px] text-lupo-black">
                            ${option.cost.toFixed(2)}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] text-lupo-text">
                          Entrega estimada: {option.minDays} a {option.maxDays} días hábiles.
                        </p>
                      </label>
                    );
                  })}
                </div>
              )}
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
                    <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-lupo-border bg-white px-3 py-2.5 text-[12px] text-lupo-text">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-lupo-black" aria-hidden />
                      <span>
                        Datos sensibles en iframes seguros de Mercado Pago. No guardamos el número completo en nuestros
                        servidores.
                      </span>
                    </div>

                    {paymentTotal > 0 && paymentTotal < 150 && (
                      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-[12px] text-amber-950">
                        <strong className="font-medium">Monto bajo:</strong> con totales muy chicos Mercado Pago a veces
                        no muestra opciones de cuotas o falla al cargarlas. Si ves el menú vacío, aumentá el pedido o pagá
                        en un solo pago.
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">
                        <div className="min-w-0 flex flex-col">
                          <label className="mb-2 block min-h-[28px] text-[11px] font-semibold uppercase tracking-[1px] text-lupo-black">
                            Número de tarjeta
                          </label>
                          <div id="form-checkout__cardNumber" className={mpIframeClass} />
                        </div>
                        <div className="min-w-0 flex flex-col">
                          <label className="mb-2 block min-h-[28px] text-[11px] font-semibold uppercase tracking-[1px] text-lupo-black">
                            Vencimiento
                          </label>
                          <div id="form-checkout__expirationDate" className={mpIframeClass} />
                        </div>
                      </div>
                      <p className="text-[11px] leading-snug text-lupo-muted [-webkit-font-smoothing:antialiased]">
                        <span className="font-medium text-lupo-black">MM/AA</span>: mes y año en dos cifras (p. ej.{' '}
                        <span className="font-mono text-lupo-black">08/28</span>). Tiene que ser una fecha futura.
                      </p>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">
                        <div className="min-w-0 flex flex-col">
                          <label className="mb-2 block min-h-[28px] text-[11px] font-semibold uppercase tracking-[1px] text-lupo-black">
                            Código de seguridad
                          </label>
                          <div id="form-checkout__securityCode" className={mpIframeClass} />
                        </div>
                        <div className="min-w-0 flex flex-col">
                          <label className="mb-2 block min-h-[28px] text-[11px] font-semibold uppercase tracking-[1px] text-lupo-black" htmlFor="form-checkout__cardholderName">
                            Titular
                          </label>
                          <input id="form-checkout__cardholderName" className={inputClass} autoComplete="cc-name" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">
                        <div className="min-w-0 flex flex-col">
                          <label className="mb-2 block min-h-[28px] text-[11px] font-semibold uppercase tracking-[1px] text-lupo-black" htmlFor="form-checkout__identificationType">
                            Tipo de documento
                          </label>
                          <select id="form-checkout__identificationType" className={`${inputClass} cursor-pointer`} />
                        </div>
                        <div className="min-w-0 flex flex-col">
                          <label className="mb-2 block min-h-[28px] text-[11px] font-semibold uppercase tracking-[1px] text-lupo-black" htmlFor="form-checkout__identificationNumber">
                            Número de documento
                          </label>
                          <input id="form-checkout__identificationNumber" className={inputClass} autoComplete="off" />
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[1px] text-lupo-black" htmlFor="form-checkout__cardholderEmail">
                          Email del titular
                        </label>
                        <input
                          id="form-checkout__cardholderEmail"
                          type="email"
                          className={inputClass}
                          autoComplete="email"
                        />
                        <p className="mt-1.5 text-[11px] text-lupo-muted">
                          Si ya lo cargaste arriba en contacto, lo rellenamos al abrir esta sección.
                        </p>
                      </div>

                      <div className="rounded-lg border border-dashed border-lupo-border bg-white/80 px-3 py-2.5 text-[11px] leading-relaxed text-lupo-text">
                        Las <span className="font-medium text-lupo-black">cuotas</span> las arma Mercado Pago según la
                        tarjeta y el importe. Con montos reducidos a veces solo hay pago único o la lista falla hasta que
                        suba el total.
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">
                        <div className="min-w-0 flex flex-col">
                          <label
                            className="mb-2 block min-h-[28px] text-[11px] font-semibold uppercase tracking-[1px] text-lupo-black"
                            htmlFor="form-checkout__issuer_display"
                          >
                            Banco emisor
                          </label>
                          <div className="relative">
                            <Landmark
                              size={18}
                              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lupo-muted"
                              aria-hidden
                            />
                            <input
                              id="form-checkout__issuer_display"
                              value={issuerDisplayName}
                              readOnly
                              className={`${inputClass} pl-10 pr-10`}
                            />
                            <select
                              id="form-checkout__issuerHidden"
                              className="absolute inset-0 h-12 w-full cursor-pointer opacity-0"
                              aria-label="Banco emisor"
                            />
                          </div>
                        </div>
                        <div className="min-w-0 flex flex-col">
                          <label className="mb-2 block min-h-[28px] text-[11px] font-semibold uppercase tracking-[1px] text-lupo-black" htmlFor="form-checkout__installments">
                            Cuotas
                          </label>
                          <select id="form-checkout__installments" className={`${inputClass} cursor-pointer`} />
                        </div>
                      </div>
                    </div>
                    {!cardFormReady && !cardFormError && (
                      <p className="mt-4 flex items-center gap-2 text-[13px] text-lupo-text">
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                        Preparando campos seguros…
                      </p>
                    )}
                    {cardFormError && (
                      <div
                        role="alert"
                        className="mt-5 flex gap-3 rounded-lg border border-red-200 bg-red-50/95 px-4 py-3 text-[13px] leading-relaxed text-red-900"
                      >
                        <AlertCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-red-700" aria-hidden />
                        <p className="min-w-0 whitespace-pre-wrap">{cardFormError}</p>
                      </div>
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
              <div
                role="alert"
                className="flex gap-3 rounded-lg border border-red-200 bg-red-50/95 px-4 py-3 text-[13px] leading-relaxed text-red-900"
              >
                <AlertCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-red-700" aria-hidden />
                <p className="min-w-0 whitespace-pre-wrap">{error}</p>
              </div>
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
                <span className={`font-medium tabular-nums ${shippingCost <= 0 ? 'text-[#2E7D32]' : 'text-lupo-black'}`}>
                  {shippingLoading ? 'Calculando…' : `$${shippingCost.toFixed(2)}`}
                </span>
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
