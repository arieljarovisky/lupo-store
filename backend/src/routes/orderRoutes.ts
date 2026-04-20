import { Router, type Request } from 'express';
import { optionalCustomerAuth } from '../middleware/auth.js';
import {
  createCheckoutOrder,
  processMercadoPagoCardPayment,
  quoteCheckoutShipping,
  syncOrderPaymentFromMercadoPago,
} from '../repos/ordersRepo.js';
import { micorreoFetchAgencies, micorreoIsConfigured } from '../services/micorreo.js';

export const orderRouter = Router();

type MercadoPagoWebhookBody = {
  type?: string;
  action?: string;
  topic?: string;
  data?: { id?: string | number };
  resource?: string;
};

function pickPaymentId(req: Request): string | null {
  const queryType = String(req.query.type ?? req.query.topic ?? '').toLowerCase();
  const queryId = req.query['data.id'] ?? req.query.id;
  if (queryId && queryType.includes('payment')) {
    return String(queryId);
  }

  const body = req.body as MercadoPagoWebhookBody;
  if (body?.data?.id && (body.type === 'payment' || body.topic === 'payment' || body.action?.includes('payment'))) {
    return String(body.data.id);
  }

  if (body?.resource && body.resource.includes('/v1/payments/')) {
    const match = body.resource.match(/\/v1\/payments\/(\d+)/);
    if (match?.[1]) return match[1];
  }

  return null;
}

orderRouter.get('/webhooks/mercado-pago', (_req, res) => {
  res.status(200).send('ok');
});

// Algunos chequeos / simuladores usan HEAD u OPTIONS antes del POST.
orderRouter.head('/webhooks/mercado-pago', (_req, res) => {
  res.status(200).end();
});

orderRouter.post('/webhooks/mercado-pago', async (req, res) => {
  try {
    const paymentId = pickPaymentId(req);
    if (!paymentId) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      res.status(500).json({ error: 'Falta MERCADO_PAGO_ACCESS_TOKEN para consultar el estado del pago.' });
      return;
    }

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!paymentRes.ok) {
      const txt = await paymentRes.text();
      throw new Error(`Mercado Pago respondió ${paymentRes.status}: ${txt}`);
    }

    const payment = (await paymentRes.json()) as {
      id?: number | string;
      status?: string;
      external_reference?: string;
      metadata?: { preference_id?: string };
    };

    const synced = await syncOrderPaymentFromMercadoPago({
      paymentId: String(payment.id ?? paymentId),
      mercadoPagoStatus: String(payment.status ?? 'pending'),
      externalReference: payment.external_reference ?? null,
      preferenceId: payment.metadata?.preference_id ?? null,
    });

    res.status(200).json({ ok: true, ...synced });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : 'No se pudo procesar webhook de Mercado Pago.';
    res.status(500).json({ error: msg });
  }
});

orderRouter.use(optionalCustomerAuth);

orderRouter.post('/shipping/quote', async (req, res) => {
  try {
    const body = req.body as {
      items?: { productId?: string; quantity?: number }[];
      address?: { zipcode?: string; city?: string; province?: string; country?: string };
      deliveredType?: string;
    };
    const items = Array.isArray(body.items)
      ? body.items
          .map((it) => ({
            productId: String(it.productId ?? '').trim(),
            quantity: Math.max(0, Math.floor(Number(it.quantity ?? 0))),
          }))
          .filter((it) => it.productId && it.quantity > 0)
      : [];
    const address = body.address ?? {};
    const dt = String(body.deliveredType ?? 'D').toUpperCase();
    const deliveredType: 'D' | 'S' = dt === 'S' ? 'S' : 'D';

    const quote = await quoteCheckoutShipping({
      items,
      deliveredType,
      address: {
        zipcode: String(address.zipcode ?? ''),
        city: address.city ? String(address.city) : null,
        province: address.province ? String(address.province) : null,
        country: address.country ? String(address.country) : null,
      },
    });

    res.status(200).json({ ok: true, ...quote });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo calcular el envío.';
    res.status(400).json({ error: msg });
  }
});

orderRouter.get('/shipping/agencies', async (req, res) => {
  try {
    if (!micorreoIsConfigured()) {
      res.status(400).json({ error: 'MiCorreo no está configurado (faltan variables de entorno).' });
      return;
    }
    const provinceCode = String(req.query.provinceCode ?? '').trim();
    const rows = await micorreoFetchAgencies(provinceCode);
    const agencies = rows.map((a) => {
      const addr = a.location?.address;
      const street = [addr?.streetName, addr?.streetNumber].filter(Boolean).join(' ');
      return {
        code: a.code,
        name: a.name,
        locality: addr?.locality ?? '',
        postalCode: addr?.postalCode ?? '',
        street,
      };
    });
    res.status(200).json({ ok: true, agencies });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudieron cargar las sucursales.';
    res.status(400).json({ error: msg });
  }
});

orderRouter.post('/:orderId/payments/mercado-pago/card', async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      res.status(400).json({ error: 'orderId inválido.' });
      return;
    }
    const body = req.body as {
      token?: string;
      paymentMethodId?: string;
      issuerId?: string;
      installments?: number;
      payerEmail?: string;
      identificationType?: string;
      identificationNumber?: string;
    };
    if (!body.token?.trim()) {
      res.status(400).json({ error: 'Falta token de tarjeta.' });
      return;
    }
    if (!body.paymentMethodId?.trim()) {
      res.status(400).json({ error: 'Falta paymentMethodId.' });
      return;
    }
    if (!body.payerEmail?.trim()) {
      res.status(400).json({ error: 'Falta email del pagador.' });
      return;
    }

    const result = await processMercadoPagoCardPayment({
      orderId,
      token: body.token.trim(),
      paymentMethodId: body.paymentMethodId.trim(),
      issuerId: body.issuerId?.trim() || null,
      installments: Number(body.installments ?? 1),
      payerEmail: body.payerEmail.trim(),
      identificationType: body.identificationType?.trim() || null,
      identificationNumber: body.identificationNumber?.trim() || null,
    });

    res.status(200).json({
      ok: true,
      paymentStatus: result.paymentStatus,
      orderStatus: result.orderStatus,
      paymentId: result.paymentId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo procesar el pago con tarjeta.';
    res.status(400).json({ error: msg });
  }
});

orderRouter.post('/checkout', async (req, res) => {
  try {
    const body = req.body as {
      items?: { productId: string; quantity: number }[];
      guestEmail?: string;
      guestPhone?: string;
      notes?: string;
      paymentMethod?: 'mercado_pago' | 'card' | 'bank_transfer' | 'cash';
      installments?: number;
      shippingCost?: number;
      shippingLabel?: string;
      shippingOptionId?: string;
      shippingProvider?: string;
      shippingZipcode?: string;
      shippingAgencyCode?: string;
      shippingAgencyName?: string;
      shippingDeliveredType?: 'D' | 'S';
      shippingProductType?: string;
    };
    const items = Array.isArray(body.items) ? body.items : [];
    const customerId = (req as Request & { customerId?: number }).customerId;

    const result = await createCheckoutOrder({
      items,
      guestEmail: body.guestEmail,
      guestPhone: body.guestPhone,
      notes: body.notes,
      customerId: customerId ?? null,
      paymentMethod: body.paymentMethod,
      installments: body.installments,
      shippingCost: body.shippingCost,
      shippingLabel: body.shippingLabel,
      shippingOptionId: body.shippingOptionId,
      shippingProvider: body.shippingProvider,
      shippingZipcode: body.shippingZipcode,
      shippingAgencyCode: body.shippingAgencyCode,
      shippingAgencyName: body.shippingAgencyName,
      shippingDeliveredType: body.shippingDeliveredType,
      shippingProductType: body.shippingProductType,
    });

    res.status(201).json({ ok: true, orderId: result.orderId, checkoutUrl: result.checkoutUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo crear el pedido';
    res.status(400).json({ error: msg });
  }
});
