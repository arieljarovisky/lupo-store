import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { mapTiendaNubeProduct } from './mapTiendaNube.js';
import { fetchAllProductsFromTiendaNube } from './tiendanubeClient.js';
import { loadProducts, saveProducts } from './productStore.js';
import type { Product } from './types.js';

const PORT = Number(process.env.PORT) || 4000;
const IMPORT_API_KEY = process.env.IMPORT_API_KEY?.trim();
const TN_STORE_ID = process.env.TIENDANUBE_STORE_ID?.trim();
const TN_TOKEN = process.env.TIENDANUBE_ACCESS_TOKEN?.trim();
const TN_USER_AGENT = process.env.TIENDANUBE_USER_AGENT?.trim();
const TN_API_VERSION = process.env.TIENDANUBE_API_VERSION?.trim() || '2025-03';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

function assertImportKey(req: express.Request): boolean {
  if (!IMPORT_API_KEY) return true;
  const key = req.header('x-import-key');
  return key === IMPORT_API_KEY;
}

function publicProduct(p: Product): Product {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    image: p.image,
    category: p.category,
    description: p.description,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/products', async (_req, res) => {
  try {
    const list = await loadProducts();
    res.json(list.map(publicProduct));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudieron leer los productos.' });
  }
});

app.post('/api/admin/import/tiendanube', async (req, res) => {
  if (!assertImportKey(req)) {
    res.status(401).json({ error: 'Clave de importación inválida.' });
    return;
  }

  if (!TN_STORE_ID || !TN_TOKEN || !TN_USER_AGENT) {
    res.status(400).json({
      error:
        'Falta configuración de Tienda Nube. Definí TIENDANUBE_STORE_ID, TIENDANUBE_ACCESS_TOKEN y TIENDANUBE_USER_AGENT en el entorno del backend.',
    });
    return;
  }

  try {
    const rawList = await fetchAllProductsFromTiendaNube({
      storeId: TN_STORE_ID,
      accessToken: TN_TOKEN,
      userAgent: TN_USER_AGENT,
      apiVersion: TN_API_VERSION,
    });

    const mapped: Product[] = [];
    for (const raw of rawList) {
      const p = mapTiendaNubeProduct(raw);
      if (p) mapped.push(p);
    }

    await saveProducts(mapped);

    res.json({
      ok: true,
      imported: mapped.length,
      message: `Se importaron ${mapped.length} productos desde Tienda Nube.`,
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    res.status(502).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
});
