import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../pool.js';
import { getProductById } from './productsRepo.js';
import type { Order, OrderItem } from '../types.js';

export async function createCheckoutOrder(params: {
  items: { productId: string; quantity: number }[];
  guestEmail?: string | null;
  guestPhone?: string | null;
  notes?: string | null;
  customerId?: number | null;
}): Promise<number> {
  const email = params.guestEmail?.trim() || null;
  const phone = params.guestPhone?.trim() || null;
  if (!email && !phone) {
    throw new Error('Indicá un email o un teléfono de contacto (WhatsApp).');
  }
  if (params.items.length === 0) {
    throw new Error('El pedido no tiene productos.');
  }

  const p = await getPool();
  const conn = await p.getConnection();
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

    const total = subtotal;
    const [ins] = await conn.query<ResultSetHeader>(
      `INSERT INTO orders (customer_id, guest_email, guest_phone, status, payment_status, subtotal, total, currency, notes)
       VALUES (?, ?, ?, 'pending', 'unpaid', ?, ?, 'ARS', ?)`,
      [
        params.customerId ?? null,
        email,
        phone,
        subtotal,
        total,
        params.notes?.trim() || null,
      ]
    );
    const orderId = Number(ins.insertId);

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

    await conn.commit();
    return orderId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function listOrdersForAdmin(limit = 100): Promise<Order[]> {
  const p = await getPool();
  const [orderRows] = await p.query<RowDataPacket[]>(
    `SELECT id, customer_id, guest_email, guest_phone, status, payment_status, subtotal, total, currency, created_at
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
