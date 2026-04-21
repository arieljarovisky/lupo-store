import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { getPool } from '../pool.js';
import { getProductById, restoreStockForCancelledOrderLine } from './productsRepo.js';
import type { Order, OrderItem, PaymentMethod } from '../types.js';
import {
  micorreoDefaultDimensions,
  micorreoFetchRates,
  micorreoIsConfigured,
} from '../services/micorreo.js';

const INSTALLMENT_INTEREST_RATE: Record<number, number> = {
  1: 0,
  3: 0.1,
  6: 0.2,
  12: 0.35,
};

function roundCurrency(value: number): number {
  return Math.round(value);
}

function resolvePaymentStatus(method: PaymentMethod): string {
  if (method === 'card' || method === 'mercado_pago') return 'pending';
  return 'unpaid';
}

function assertPaymentMethod(method: string | undefined): PaymentMethod {
  if (!method) return 'cash';
  if (method === 'mercado_pago' || method === 'card' || method === 'bank_transfer' || method === 'cash') {
    return method;
  }
  throw new Error('Método de pago inválido.');
}

function mapMercadoPagoStatus(status: string): 'pending' | 'paid' | 'failed' | 'refunded' {
  if (status === 'approved') return 'paid';
  if (status === 'refunded') return 'refunded';
  if (status === 'rejected' || status === 'cancelled' || status === 'charged_back') return 'failed';
  return 'pending';
}

async function createMercadoPagoPreference(params: {
  orderId: number;
  lines: Array<{ name: string; qty: number; unit: number }>;
  guestEmail: string | null;
  shippingCost?: number;
  shippingLabel?: string | null;
}): Promise<{ checkoutUrl: string | null; paymentReference: string | null }> {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return { checkoutUrl: null, paymentReference: null };
  }

  const body = {
    external_reference: String(params.orderId),
    payer: params.guestEmail ? { email: params.guestEmail } : undefined,
    items: [
      ...params.lines.map((line) => ({
        title: line.name,
        quantity: line.qty,
        currency_id: 'ARS',
        unit_price: line.unit,
      })),
      ...(Number(params.shippingCost ?? 0) > 0
        ? [
            {
              title: params.shippingLabel?.trim() || 'Envío',
              quantity: 1,
              currency_id: 'ARS',
              unit_price: Math.round(Number(params.shippingCost)),
            },
          ]
        : []),
    ],
    back_urls: {
      success: process.env.MERCADO_PAGO_SUCCESS_URL?.trim() || process.env.FRONTEND_URL?.trim() || undefined,
      failure: process.env.MERCADO_PAGO_FAILURE_URL?.trim() || process.env.FRONTEND_URL?.trim() || undefined,
      pending: process.env.MERCADO_PAGO_PENDING_URL?.trim() || process.env.FRONTEND_URL?.trim() || undefined,
    },
    auto_return: 'approved',
  };

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`No se pudo crear la preferencia de Mercado Pago. ${txt || `HTTP ${res.status}`}`);
  }

  const json = (await res.json()) as {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
  };
  return {
    checkoutUrl: json.init_point || json.sandbox_init_point || null,
    paymentReference: json.id || null,
  };
}

export type CheckoutShippingEngine = 'micorreo' | 'local';

export interface CheckoutShippingQuoteOption {
  id: string;
  provider: 'tiendanube' | 'micorreo';
  carrier: 'correo_argentino';
  label: string;
  cost: number;
  minDays: number;
  maxDays: number;
  /** Solo MiCorreo: D domicilio, S sucursal/depósito. */
  deliveredType?: 'D' | 'S';
  productType?: string | null;
}

export interface OrderNotificationSnapshot {
  id: number;
  guestEmail: string | null;
  status: string;
  paymentStatus: string;
  total: number;
  currency: string;
  shippingTrackingNumber: string | null;
  shippingProvider: string | null;
  shippingStatus: string | null;
}

function normalizeZipcode(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (!t) return '';
  return t.replace(/[^A-Z0-9]/g, '');
}

function quoteCheckoutShippingLocal(params: {
  zipcode: string;
  subtotal: number;
}): CheckoutShippingQuoteOption[] {
  const { zipcode, subtotal } = params;
  const freeOver = Math.max(0, Math.round(Number(process.env.SHIPPING_FREE_OVER_ARS ?? '0') || 0));
  const digits = zipcode.replace(/\D/g, '');
  const prefix2 = digits.slice(0, 2);
  const ambaPrefixes = new Set(['10', '11', '12', '13', '14', '15', '16', '17', '18', '19']);
  const isAmba = prefix2.length === 2 && ambaPrefixes.has(prefix2);

  const standardCost = isAmba ? 4500 : 6900;
  const expressCost = isAmba ? 6500 : 9800;
  const standardDays = isAmba ? { min: 2, max: 4 } : { min: 3, max: 6 };
  const expressDays = isAmba ? { min: 1, max: 2 } : { min: 2, max: 4 };

  const options: CheckoutShippingQuoteOption[] = [];
  if (freeOver > 0 && subtotal >= freeOver) {
    options.push({
      id: 'correo_argentino_free',
      provider: 'tiendanube',
      carrier: 'correo_argentino',
      label: 'Correo Argentino (Tienda Nube) - Envío gratis',
      cost: 0,
      minDays: standardDays.min,
      maxDays: standardDays.max,
      deliveredType: 'D',
    });
  }
  options.push(
    {
      id: 'correo_argentino_standard',
      provider: 'tiendanube',
      carrier: 'correo_argentino',
      label: 'Correo Argentino (Tienda Nube) - Clásico a domicilio',
      cost: standardCost,
      minDays: standardDays.min,
      maxDays: standardDays.max,
      deliveredType: 'D',
    },
    {
      id: 'correo_argentino_express',
      provider: 'tiendanube',
      carrier: 'correo_argentino',
      label: 'Correo Argentino (Tienda Nube) - Expreso a domicilio',
      cost: expressCost,
      minDays: expressDays.min,
      maxDays: expressDays.max,
      deliveredType: 'D',
    }
  );
  return options;
}

/**
 * Cotización: si hay credenciales MiCorreo, usa POST /rates (Correo Argentino oficial).
 * Si no, mantiene la cotización local (Tienda Nube / heurística por CP).
 */
export async function quoteCheckoutShipping(params: {
  items: { productId: string; quantity: number }[];
  address: { zipcode: string; city?: string | null; province?: string | null; country?: string | null };
  deliveredType?: 'D' | 'S';
}): Promise<{
  currency: 'ARS';
  subtotal: number;
  options: CheckoutShippingQuoteOption[];
  shippingEngine: CheckoutShippingEngine;
}> {
  const zipcode = normalizeZipcode(params.address.zipcode);
  if (zipcode.length < 4) {
    throw new Error('Ingresá un código postal válido para calcular el envío.');
  }
  if (params.items.length === 0) {
    throw new Error('El carrito está vacío.');
  }

  let subtotal = 0;
  for (const it of params.items) {
    const qty = Math.max(0, Math.floor(Number(it.quantity)));
    if (qty <= 0) continue;
    const prod = await getProductById(String(it.productId));
    if (!prod) {
      throw new Error(`Producto no encontrado: ${it.productId}`);
    }
    subtotal += qty * Math.round(Number(prod.price) || 0);
  }

  const deliveredType: 'D' | 'S' = params.deliveredType === 'S' ? 'S' : 'D';
  const freeOver = Math.max(0, Math.round(Number(process.env.SHIPPING_FREE_OVER_ARS ?? '0') || 0));

  if (micorreoIsConfigured()) {
    const origin = normalizeZipcode(process.env.MICORREO_POSTAL_CODE_ORIGIN ?? '');
    if (origin.length < 4) {
      throw new Error('MICORREO_POSTAL_CODE_ORIGIN inválido o demasiado corto.');
    }
    const dimensions = micorreoDefaultDimensions();
    const rows = await micorreoFetchRates({
      postalCodeOrigin: origin,
      postalCodeDestination: zipcode,
      deliveredType,
      dimensions,
    });

    const options: CheckoutShippingQuoteOption[] = [];
    const modeLabel = deliveredType === 'S' ? 'retiro en sucursal' : 'a domicilio';

    for (const r of rows) {
      const dt = r.deliveredType === 'S' ? 'S' : 'D';
      if (dt !== deliveredType) continue;
      const minDays = Math.max(0, Math.floor(Number(r.deliveryTimeMin) || 0));
      const maxDays = Math.max(minDays, Math.floor(Number(r.deliveryTimeMax) || minDays));
      const cost = Math.max(0, Math.round(Number(r.price) || 0));
      options.push({
        id: `micorreo:${r.productType}:${dt}`,
        provider: 'micorreo',
        carrier: 'correo_argentino',
        label: `${r.productName} — ${modeLabel}`,
        cost,
        minDays: minDays || 1,
        maxDays: maxDays || minDays || 1,
        deliveredType: dt,
        productType: r.productType,
      });
    }

    if (freeOver > 0 && subtotal >= freeOver && options.length > 0) {
      const cheapest = options.reduce((a, b) => (a.cost <= b.cost ? a : b));
      options.unshift({
        id: 'micorreo_free',
        provider: 'micorreo',
        carrier: 'correo_argentino',
        label: `Promoción envío gratis (${modeLabel})`,
        cost: 0,
        minDays: cheapest.minDays,
        maxDays: cheapest.maxDays,
        deliveredType,
        productType: cheapest.productType ?? null,
      });
    }

    if (options.length === 0) {
      throw new Error('MiCorreo no devolvió tarifas para ese código postal y tipo de entrega.');
    }

    return {
      currency: 'ARS',
      subtotal,
      options,
      shippingEngine: 'micorreo',
    };
  }

  return {
    currency: 'ARS',
    subtotal,
    options: quoteCheckoutShippingLocal({ zipcode, subtotal }),
    shippingEngine: 'local',
  };
}

export async function createCheckoutOrder(params: {
  items: { productId: string; quantity: number }[];
  guestEmail?: string | null;
  guestPhone?: string | null;
  notes?: string | null;
  customerId?: number | null;
  paymentMethod?: string;
  installments?: number;
  shippingCost?: number;
  shippingLabel?: string | null;
  shippingOptionId?: string | null;
  shippingProvider?: string | null;
  shippingZipcode?: string | null;
  shippingAgencyCode?: string | null;
  shippingAgencyName?: string | null;
  shippingDeliveredType?: 'D' | 'S' | null;
  shippingProductType?: string | null;
}): Promise<{ orderId: number; checkoutUrl: string | null }> {
  const email = params.guestEmail?.trim() || null;
  const phone = params.guestPhone?.trim() || null;
  if (!email && !phone) {
    throw new Error('Indicá un email o un teléfono de contacto (WhatsApp).');
  }
  if (params.items.length === 0) {
    throw new Error('El pedido no tiene productos.');
  }
  const paymentMethod = assertPaymentMethod(params.paymentMethod);
  const installments =
    paymentMethod === 'card' ? Math.max(1, Math.floor(Number(params.installments ?? 1))) : 1;
  /**
   * Tarjeta embebida (CardForm): el SDK fija el monto con el total del carrito. Si acá sumamos recargo por
   * cuotas, Mercado Pago rechaza el pago (Invalid transaction_amount) al no coincidir con el token.
   * El plan de cuotas lo define MP en el cobro; no aplicamos interés comercial extra en este flujo.
   */
  const interestRate =
    paymentMethod === 'card' ? 0 : INSTALLMENT_INTEREST_RATE[installments] ?? 0;
  const shippingCost = Math.max(0, Math.round(Number(params.shippingCost ?? 0) || 0));
  const shippingLabel = params.shippingLabel?.trim() || null;
  const shippingOptionId = params.shippingOptionId?.trim() || null;
  const shippingProvider = params.shippingProvider?.trim() || null;
  const shippingZipcode = params.shippingZipcode?.trim() || null;
  const shippingAgencyCode = params.shippingAgencyCode?.trim() || null;
  const shippingAgencyName = params.shippingAgencyName?.trim() || null;
  const shippingDeliveredType = params.shippingDeliveredType === 'S' ? 'S' : params.shippingDeliveredType === 'D' ? 'D' : null;
  const shippingProductType = params.shippingProductType?.trim() || null;

  const p = await getPool();
  const conn = await p.getConnection();
  let orderId: number | null = null;
  let checkoutUrl: string | null = null;
  try {
    await conn.beginTransaction();

    let subtotal = 0;
    const lines: Array<{
      productId: string;
      name: string;
      unit: number;
      qty: number;
      line: number;
    }> = [];

    for (const it of params.items) {
      if (it.quantity < 1) {
        throw new Error('Cantidad inválida.');
      }
      const prod = await getProductById(it.productId);
      if (!prod) {
        throw new Error(`Producto no encontrado: ${it.productId}`);
      }
      if (prod.stockQuantity < it.quantity) {
        throw new Error(`Stock insuficiente para «${prod.name}».`);
      }
      const unit = prod.price;
      const line = unit * it.quantity;
      subtotal += line;
      lines.push({
        productId: prod.id,
        name: prod.name,
        unit,
        qty: it.quantity,
        line,
      });
    }

    const baseWithShipping = subtotal + shippingCost;
    const total = roundCurrency(baseWithShipping * (1 + interestRate));
    const shippingNotes = [
      shippingLabel ? `Envío: ${shippingLabel}` : null,
      shippingOptionId ? `Envío opción: ${shippingOptionId}` : null,
      shippingProvider ? `Envío proveedor: ${shippingProvider}` : null,
      shippingZipcode ? `Envío CP: ${shippingZipcode}` : null,
      shippingDeliveredType ? `Envío tipo entrega: ${shippingDeliveredType === 'S' ? 'sucursal' : 'domicilio'}` : null,
      shippingProductType ? `Envío producto Correo: ${shippingProductType}` : null,
      shippingAgencyCode ? `Sucursal MiCorreo: ${shippingAgencyCode}${shippingAgencyName ? ` (${shippingAgencyName})` : ''}` : null,
      `Envío costo: ARS ${shippingCost}`,
    ]
      .filter(Boolean)
      .join(' · ');
    const notes = [params.notes?.trim() || null, shippingNotes].filter(Boolean).join('\n');
    const [ins] = await conn.query<ResultSetHeader>(
      `INSERT INTO orders (
        customer_id, guest_email, guest_phone, payment_method, installments, installment_interest_rate,
        status, payment_status, subtotal, total, currency, notes
      )
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 'ARS', ?)`,
      [
        params.customerId ?? null,
        email,
        phone,
        paymentMethod,
        installments,
        interestRate,
        resolvePaymentStatus(paymentMethod),
        subtotal,
        total,
        notes || null,
      ]
    );
    orderId = Number(ins.insertId);

    for (const ln of lines) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name_snapshot, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, ln.productId, ln.name, ln.unit, ln.qty, ln.line]
      );
      await conn.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [ln.qty, ln.productId]
      );
    }

    if (paymentMethod === 'mercado_pago') {
      const preference = await createMercadoPagoPreference({
        orderId,
        lines,
        guestEmail: email,
        shippingCost,
        shippingLabel,
      });
      checkoutUrl = preference.checkoutUrl;
      if (preference.paymentReference) {
        await conn.query('UPDATE orders SET payment_reference = ? WHERE id = ?', [
          preference.paymentReference,
          orderId,
        ]);
      }
    }

    await conn.commit();
    return { orderId, checkoutUrl };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function processMercadoPagoCardPayment(params: {
  orderId: number;
  token: string;
  paymentMethodId: string;
  issuerId?: string | null;
  installments: number;
  payerEmail: string;
  identificationType?: string | null;
  identificationNumber?: string | null;
}): Promise<{ paymentStatus: string; orderStatus: string; paymentId: string | null }> {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error('Falta MERCADO_PAGO_ACCESS_TOKEN en el backend.');
  }

  const p = await getPool();
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT id, subtotal, total, currency, payment_method, payment_status, status, payment_reference
     FROM orders WHERE id = ? LIMIT 1`,
    [params.orderId]
  );
  if (rows.length === 0) {
    throw new Error('Pedido no encontrado.');
  }

  const order = rows[0];
  const paymentMethod = String(order.payment_method ?? '');
  if (paymentMethod !== 'card') {
    throw new Error('Este pedido no está configurado para pago con tarjeta.');
  }

  const rawTotal = Number(order.total);
  const rawSubtotal = Number(order.subtotal);
  let transactionAmount = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 0;
  if (transactionAmount <= 0 && Number.isFinite(rawSubtotal) && rawSubtotal > 0) {
    transactionAmount = rawSubtotal;
  }
  transactionAmount = Math.round(transactionAmount * 100) / 100;
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
    throw new Error(
      'El pedido tiene un total inválido para cobrar con Mercado Pago (0 o no numérico). Revisá precios y líneas del carrito.'
    );
  }

  const installments = Math.max(1, Number(params.installments || 1));

  const paymentPayload: {
    transaction_amount: number;
    token: string;
    description: string;
    installments: number;
    payment_method_id: string;
    issuer_id?: number;
    payer: {
      email: string;
      identification?: { type: string; number: string };
    };
    external_reference: string;
    metadata: { order_id: string };
  } = {
    transaction_amount: transactionAmount,
    token: params.token,
    description: `Pedido #${params.orderId}`,
    installments,
    payment_method_id: params.paymentMethodId,
    payer: {
      email: params.payerEmail,
    },
    external_reference: String(params.orderId),
    metadata: { order_id: String(params.orderId) },
  };

  const issuerId = Number(params.issuerId || '');
  if (Number.isFinite(issuerId) && issuerId > 0) {
    paymentPayload.issuer_id = issuerId;
  }
  if (params.identificationType?.trim() && params.identificationNumber?.trim()) {
    paymentPayload.payer.identification = {
      type: params.identificationType.trim(),
      number: params.identificationNumber.trim(),
    };
  }

  const paymentRes = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify(paymentPayload),
  });
  if (!paymentRes.ok) {
    const txt = await paymentRes.text();
    throw new Error(`Mercado Pago rechazó el pago. ${txt || `HTTP ${paymentRes.status}`}`);
  }

  const payment = (await paymentRes.json()) as {
    id?: number | string;
    status?: string;
  };
  const nextPaymentStatus = mapMercadoPagoStatus(String(payment.status ?? 'pending'));
  const currentOrderStatus = String(order.status ?? 'pending');
  let nextOrderStatus = currentOrderStatus;
  if (nextPaymentStatus === 'paid') {
    nextOrderStatus = 'confirmed';
  } else if (nextPaymentStatus === 'failed' && currentOrderStatus !== 'confirmed') {
    nextOrderStatus = 'cancelled';
  }

  const paymentRefTag = `pay:${String(payment.id ?? '')}`;
  const currentRef = order.payment_reference != null ? String(order.payment_reference) : null;
  const nextReference =
    currentRef && paymentRefTag !== 'pay:' && currentRef.includes(paymentRefTag)
      ? currentRef
      : currentRef && paymentRefTag !== 'pay:'
        ? `${currentRef}|${paymentRefTag}`
        : currentRef;

  await p.query(
    'UPDATE orders SET payment_status = ?, status = ?, payment_reference = ? WHERE id = ?',
    [nextPaymentStatus, nextOrderStatus, nextReference, params.orderId]
  );

  return {
    paymentStatus: nextPaymentStatus,
    orderStatus: nextOrderStatus,
    paymentId: payment.id != null ? String(payment.id) : null,
  };
}

export async function syncOrderPaymentFromMercadoPago(params: {
  paymentId: string;
  externalReference?: string | null;
  preferenceId?: string | null;
  mercadoPagoStatus: string;
}): Promise<{ updated: boolean; orderId: number | null; paymentStatus: string }> {
  const p = await getPool();
  let orderId: number | null = null;

  const externalRef = params.externalReference?.trim() || '';
  if (/^\d+$/.test(externalRef)) {
    orderId = Number(externalRef);
  }

  if (!orderId && params.preferenceId?.trim()) {
    const [rows] = await p.query<RowDataPacket[]>(
      'SELECT id FROM orders WHERE payment_reference = ? ORDER BY id DESC LIMIT 1',
      [params.preferenceId.trim()]
    );
    if (rows[0]?.id != null) orderId = Number(rows[0].id);
  }

  const mappedPaymentStatus = mapMercadoPagoStatus(params.mercadoPagoStatus);
  if (!orderId) {
    return { updated: false, orderId: null, paymentStatus: mappedPaymentStatus };
  }

  const [currentRows] = await p.query<RowDataPacket[]>(
    'SELECT payment_status, status, payment_reference FROM orders WHERE id = ? LIMIT 1',
    [orderId]
  );
  if (currentRows.length === 0) {
    return { updated: false, orderId: null, paymentStatus: mappedPaymentStatus };
  }

  const currentPaymentStatus = String(currentRows[0].payment_status ?? 'unpaid');
  const currentOrderStatus = String(currentRows[0].status ?? 'pending');
  const currentReference = currentRows[0].payment_reference != null ? String(currentRows[0].payment_reference) : null;

  let nextPaymentStatus = mappedPaymentStatus;
  // Evita "retroceder" pagos confirmados por eventos fuera de orden.
  if (currentPaymentStatus === 'paid' && mappedPaymentStatus !== 'refunded') {
    nextPaymentStatus = 'paid';
  }
  if (currentPaymentStatus === 'refunded') {
    nextPaymentStatus = 'refunded';
  }

  let nextOrderStatus = currentOrderStatus;
  if (nextPaymentStatus === 'paid') {
    nextOrderStatus = 'confirmed';
  } else if (nextPaymentStatus === 'failed' && currentOrderStatus !== 'confirmed') {
    nextOrderStatus = 'cancelled';
  }

  const paymentRefTag = `pay:${params.paymentId}`;
  const nextReference =
    currentReference && currentReference.includes(paymentRefTag)
      ? currentReference
      : currentReference
        ? `${currentReference}|${paymentRefTag}`
        : paymentRefTag;

  const [upd] = await p.query<ResultSetHeader>(
    'UPDATE orders SET payment_status = ?, status = ?, payment_reference = ? WHERE id = ?',
    [nextPaymentStatus, nextOrderStatus, nextReference, orderId]
  );

  return {
    updated: upd.affectedRows > 0,
    orderId,
    paymentStatus: nextPaymentStatus,
  };
}

export async function cancelOrderAndRestoreStock(orderId: number): Promise<void> {
  const p = await getPool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const [orderRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, status FROM orders WHERE id = ? LIMIT 1`,
      [orderId]
    );
    if (!orderRows.length) {
      throw new Error('Pedido no encontrado.');
    }
    if (String(orderRows[0].status) === 'cancelled') {
      throw new Error('El pedido ya está cancelado.');
    }

    const [itemRows] = await conn.query<RowDataPacket[]>(
      `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
      [orderId]
    );
    for (const it of itemRows) {
      await restoreStockForCancelledOrderLine(conn, String(it.product_id), Number(it.quantity));
    }

    await conn.query(
      `UPDATE orders SET status = 'cancelled',
         payment_status = CASE
           WHEN payment_status = 'paid' THEN 'refunded'
           ELSE 'failed'
         END
       WHERE id = ?`,
      [orderId]
    );

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateOrderShipment(params: {
  orderId: number;
  trackingNumber: string;
  provider?: string | null;
  status?: string | null;
}): Promise<void> {
  const p = await getPool();
  const trackingNumber = String(params.trackingNumber ?? '').trim();
  if (!trackingNumber) throw new Error('El número de envío es obligatorio.');
  const provider = params.provider?.trim() || 'manual';
  const status = params.status?.trim() || 'created';
  const [upd] = await p.query<ResultSetHeader>(
    `UPDATE orders
     SET shipping_tracking_number = ?, shipping_provider = ?, shipping_status = ?
     WHERE id = ?`,
    [trackingNumber, provider, status, params.orderId]
  );
  if (upd.affectedRows === 0) {
    throw new Error('Pedido no encontrado.');
  }
}

export async function getOrderNotificationSnapshot(orderId: number): Promise<OrderNotificationSnapshot | null> {
  const p = await getPool();
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT
      id,
      guest_email,
      status,
      payment_status,
      total,
      currency,
      shipping_tracking_number,
      shipping_provider,
      shipping_status
     FROM orders
     WHERE id = ?
     LIMIT 1`,
    [orderId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: Number(row.id),
    guestEmail: row.guest_email != null ? String(row.guest_email) : null,
    status: String(row.status ?? 'pending'),
    paymentStatus: String(row.payment_status ?? 'unpaid'),
    total: Number(row.total ?? 0),
    currency: String(row.currency ?? 'ARS'),
    shippingTrackingNumber: row.shipping_tracking_number != null ? String(row.shipping_tracking_number) : null,
    shippingProvider: row.shipping_provider != null ? String(row.shipping_provider) : null,
    shippingStatus: row.shipping_status != null ? String(row.shipping_status) : null,
  };
}

export async function listOrdersForAdmin(limit = 100): Promise<Order[]> {
  const p = await getPool();
  const [orderRows] = await p.query<RowDataPacket[]>(
    `SELECT
      id, customer_id, guest_email, guest_phone, payment_method, installments, installment_interest_rate,
      payment_reference, status, payment_status, subtotal, total, currency, created_at,
      shipping_tracking_number, shipping_provider, shipping_status
     FROM orders ORDER BY created_at DESC LIMIT ?`,
    [Math.min(limit, 500)]
  );
  const orders: Order[] = [];
  for (const o of orderRows) {
    const id = Number(o.id);
    const [itemRows] = await p.query<RowDataPacket[]>(
      `SELECT id, product_id, product_name_snapshot, unit_price, quantity, line_total
       FROM order_items WHERE order_id = ?`,
      [id]
    );
    const items: OrderItem[] = itemRows.map((r) => ({
      id: Number(r.id),
      productId: String(r.product_id),
      productNameSnapshot: String(r.product_name_snapshot),
      unitPrice: Number(r.unit_price),
      quantity: Number(r.quantity),
      lineTotal: Number(r.line_total),
    }));
    orders.push({
      id,
      customerId: o.customer_id != null ? Number(o.customer_id) : null,
      guestEmail: o.guest_email != null ? String(o.guest_email) : null,
      guestPhone: o.guest_phone != null ? String(o.guest_phone) : null,
      paymentMethod: String(o.payment_method ?? 'cash') as PaymentMethod,
      installments: Number(o.installments ?? 1),
      installmentInterestRate: Number(o.installment_interest_rate ?? 0),
      paymentReference: o.payment_reference != null ? String(o.payment_reference) : null,
      status: String(o.status),
      paymentStatus: String(o.payment_status),
      subtotal: Number(o.subtotal),
      total: Number(o.total),
      currency: String(o.currency ?? 'ARS'),
      shippingTrackingNumber: o.shipping_tracking_number != null ? String(o.shipping_tracking_number) : null,
      shippingProvider: o.shipping_provider != null ? String(o.shipping_provider) : null,
      shippingStatus: o.shipping_status != null ? String(o.shipping_status) : null,
      createdAt: new Date(String(o.created_at)).toISOString(),
      items,
    });
  }
  return orders;
}
