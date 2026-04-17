import { Router } from 'express';
import {
  requireHubKey,
  requireHubWebhookIdempotency,
  requireHubWebhookSignature,
} from '../middleware/auth.js';
import {
  applyStockWebhookFromHub,
  upsertProductsFromHub,
  type HubProductPayload,
  type HubStockWebhookPayloadItem,
} from '../repos/productsRepo.js';
import {
  markHubWebhookEventDone,
  releaseHubWebhookEventReservation,
} from '../repos/hubWebhookEventsRepo.js';

export const hubRouter = Router();
hubRouter.use(requireHubKey);

/** Sincronización desde Lupo Hub (stock, precios, IDs ML/TN). */
hubRouter.post('/products', async (req, res) => {
  try {
    const raw = req.body as { products?: HubProductPayload[] };
    const products = Array.isArray(raw.products) ? raw.products : [];
    if (products.length === 0) {
      res.status(400).json({ error: 'Enviá { products: [...] }.' });
      return;
    }
    for (const it of products) {
      if (!it.id || typeof it.stock_quantity !== 'number') {
        res.status(400).json({ error: 'Cada ítem requiere id y stock_quantity.' });
        return;
      }
    }
    const n = await upsertProductsFromHub(products);
    res.json({ ok: true, upserted: n });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al sincronizar con el hub.' });
  }
});

/**
 * Webhook de stock desde ERP.
 * Acepta:
 * - { updates: [{ id|sku|external_tn_id|external_ml_id, stock_quantity, variant_id?, variant_sku? }, ...] }
 * - o directamente un array de items.
 * Seguridad:
 * - x-hub-api-key (HUB_API_KEY)
 * - x-hub-timestamp + x-hub-signature HMAC SHA256 (HUB_WEBHOOK_SECRET)
 */
hubRouter.post(
  '/webhook/stock',
  requireHubWebhookSignature,
  requireHubWebhookIdempotency,
  async (req, res) => {
  try {
    const webhookId = (req as { hubWebhookEventId?: string }).hubWebhookEventId;
    const raw = req.body as { updates?: HubStockWebhookPayloadItem[] } | HubStockWebhookPayloadItem[];
    const updates = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { updates?: HubStockWebhookPayloadItem[] }).updates)
        ? (raw as { updates: HubStockWebhookPayloadItem[] }).updates
        : [];

    if (updates.length === 0) {
      res.status(400).json({
        error:
          'Enviá un array o { updates: [...] } con stock_quantity e identificador (id, sku, external_tn_id o external_ml_id).',
      });
      return;
    }

    const sync = await applyStockWebhookFromHub(updates);
    if (webhookId) {
      await markHubWebhookEventDone(webhookId);
    }
    res.json({
      ok: true,
      webhook_id: webhookId ?? null,
      ...sync,
    });
  } catch (e) {
    const webhookId = (req as { hubWebhookEventId?: string }).hubWebhookEventId;
    if (webhookId) {
      await releaseHubWebhookEventReservation(webhookId).catch(() => {
        /* noop */
      });
    }
    console.error(e);
    res.status(500).json({ error: 'Error al procesar webhook de stock.' });
  }
  }
);
