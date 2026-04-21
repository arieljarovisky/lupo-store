import { Resend } from 'resend';
import type { OrderNotificationSnapshot } from '../repos/ordersRepo.js';

type NotificationEvent =
  | 'order_created'
  | 'payment_confirmed'
  | 'payment_pending'
  | 'order_cancelled'
  | 'shipment_assigned';

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function eventCopy(event: NotificationEvent, order: OrderNotificationSnapshot): { subject: string; message: string } {
  const orderLabel = `#${order.id}`;
  if (event === 'order_created') {
    return {
      subject: `Recibimos tu pedido ${orderLabel}`,
      message:
        `Tu pedido ${orderLabel} fue creado correctamente. ` +
        `Total: ${order.currency} ${order.total.toFixed(2)}. ` +
        `Te enviaremos novedades por este medio.`,
    };
  }
  if (event === 'payment_confirmed') {
    return {
      subject: `Pago confirmado para tu pedido ${orderLabel}`,
      message: `Tu pago fue aprobado y tu pedido ${orderLabel} quedó confirmado.`,
    };
  }
  if (event === 'payment_pending') {
    return {
      subject: `Tu pago está en revisión ${orderLabel}`,
      message: `Recibimos el pago de tu pedido ${orderLabel} y está en proceso de validación.`,
    };
  }
  if (event === 'order_cancelled') {
    return {
      subject: `Pedido cancelado ${orderLabel}`,
      message: `El pedido ${orderLabel} fue cancelado. Si necesitás ayuda, respondé este email.`,
    };
  }
  const tracking = order.shippingTrackingNumber ?? 'sin número';
  return {
    subject: `Tu pedido ${orderLabel} ya fue despachado`,
    message:
      `Tu pedido ${orderLabel} ya tiene seguimiento. ` +
      `Número de envío: ${tracking}. ` +
      `Proveedor: ${order.shippingProvider || 'Correo'}.`,
  };
}

export async function sendOrderNotificationEmail(
  event: NotificationEvent,
  order: OrderNotificationSnapshot
): Promise<void> {
  const to = order.guestEmail?.trim();
  if (!to) return;
  const client = getResendClient();
  if (!client) return;
  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'Lupo Store <onboarding@resend.dev>';
  const { subject, message } = eventCopy(event, order);
  await client.emails.send({
    from,
    to,
    subject,
    text: message,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2 style="margin-bottom:8px">Lupo Store</h2>
      <p>${message}</p>
      <p style="color:#667">Pedido: <strong>#${order.id}</strong></p>
    </div>`,
  });
}
