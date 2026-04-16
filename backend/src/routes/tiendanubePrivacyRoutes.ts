import { Router } from 'express';

export const tiendanubePrivacyRouter = Router();

function ack(
  topic: 'store_redact' | 'customers_redact' | 'customers_data_request',
  payload: unknown
): { ok: true; received: string } {
  const now = new Date().toISOString();
  console.log(`[tiendanube][privacy] ${topic} recibido en ${now}`, payload);
  return { ok: true, received: now };
}

/**
 * Webhooks de privacidad requeridos por Tienda Nube.
 * Por ahora solo confirmamos recepción (ack). Si luego querés, acá se implementa
 * la lógica de borrado/exportación de datos.
 */
tiendanubePrivacyRouter.post('/store-redact', (req, res) => {
  res.json(ack('store_redact', req.body));
});

tiendanubePrivacyRouter.post('/customers-redact', (req, res) => {
  res.json(ack('customers_redact', req.body));
});

tiendanubePrivacyRouter.post('/customers-data-request', (req, res) => {
  res.json(ack('customers_data_request', req.body));
});
