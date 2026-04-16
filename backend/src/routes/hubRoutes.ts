import { Router } from 'express';
import { requireHubKey } from '../middleware/auth.js';
import { upsertProductsFromHub, type HubProductPayload } from '../repos/productsRepo.js';

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
