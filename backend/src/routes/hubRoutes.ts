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
import { hubLog } from '../logger.js';

export const hubRouter = Router();
hubRouter.use(requireHubKey);

/** Trazas: si no ves `[hub]` en Railway, el request no llega a este router (URL/CORS/proxy). */
hubRouter.use((req, _res, next) => {
  if (req.path.includes('webhook')) {
    hubLog(`→ ${req.method} ${req.path}`, {
      webhook_id: req.header('x-webhook-id') ?? null,
      has_ts: Boolean(req.header('x-hub-timestamp')),
      has_sig: Boolean(req.header('x-hub-signature')),
    });
  }
  next();
});

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
      hubLog('webhook/stock: body vacío o sin updates');
      res.status(400).json({
        error:
          'Enviá un array o { updates: [...] } con stock_quantity e identificador (id, sku, external_tn_id o external_ml_id).',
      });
      return;
    }

    hubLog('webhook/stock: procesando', {
      webhook_id: webhookId ?? null,
      items: updates.length,
    });

    const sync = await applyStockWebhookFromHub(updates);

    hubLog('webhook/stock: resultado', {
      updated: sync.updated,
      variantUpdated: sync.variantUpdated,
      received: sync.received,
      invalid: sync.invalid.length,
      notFound: sync.notFound.length,
    });
    if (sync.notFound.length > 0) {
      hubLog('webhook/stock: búsquedas sin fila en DB', {
        refs: sync.notFound.map((n) => n.ref),
      });
    }

    if (webhookId) {
      await markHubWebhookEventDone(webhookId);
    }

    const hint =
      sync.updated === 0 && sync.notFound.length > 0
        ? 'Ningún ítem coincidió en la DB (sku/id distintos o productos sin importar). Revisá catálogo y reimport desde Tienda Nube.'
        : sync.updated === 0 && sync.invalid.length > 0
          ? 'Todos los ítems fueron inválidos. Revisá stock_quantity e identificadores en el payload.'
          : undefined;

    res.json({
      ok: true,
      webhook_id: webhookId ?? null,
      ...(hint ? { hint } : {}),
      ...sync,
    });
  } catch (e) {
    const webhookId = (req as { hubWebhookEventId?: string }).hubWebhookEventId;
    if (webhookId) {
      await releaseHubWebhookEventReservation(webhookId).catch(() => {
        /* noop */
      });
    }
    hubLog('webhook/stock: error', { message: e instanceof Error ? e.message : String(e) });
    console.error(e);
    res.status(500).json({ error: 'Error al procesar webhook de stock.' });
  }
  }
);
