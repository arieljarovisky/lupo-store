import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { getPool } from '../pool.js';
import { getProductById } from './productsRepo.js';
import type { Order, OrderItem, PaymentMethod } from '../types.js';

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
}): Promise<{ checkoutUrl: string | null; paymentReference: string | null }> {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return { checkoutUrl: null, paymentReference: null };
  }

  const body = {
    external_reference: String(params.orderId),
    payer: params.guestEmail ? { email: params.guestEmail } : undefined,
    items: params.lines.map((line) => ({
      title: line.name,
      quantity: line.qty,
      currency_id: 'ARS',
      unit_price: line.unit,
    })),
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

export async function createCheckoutOrder(params: {
  items: { productId: string; quantity: number }[];
  guestEmail?: string | null;
  guestPhone?: string | null;
  notes?: string | null;
  customerId?: number | null;
  paymentMethod?: string;
  installments?: number;
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
  const installments = paymentMethod === 'card' ? Number(params.installments ?? 1) : 1;
  const interestRate = paymentMethod === 'card' ? (INSTALLMENT_INTEREST_RATE[installments] ?? 0) : 0;

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

    const total = roundCurrency(subtotal * (1 + interestRate));
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
        params.notes?.trim() || null,
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
    `SELECT id, total, currency, payment_method, payment_status, status, payment_reference
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

  const transactionAmount = Number(order.total);
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

export async function listOrdersForAdmin(limit = 100): Promise<Order[]> {
  const p = await getPool();
  const [orderRows] = await p.query<RowDataPacket[]>(
    `SELECT
      id, customer_id, guest_email, guest_phone, payment_method, installments, installment_interest_rate,
      payment_reference, status, payment_status, subtotal, total, currency, created_at
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
      createdAt: new Date(String(o.created_at)).toISOString(),
      items,
    });
  }
  return orders;
}
