import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { initDb, pingDb } from './db.js';
import { mapTiendaNubeProduct } from './mapTiendaNube.js';
import { fetchAllProductsFromTiendaNube } from './tiendanubeClient.js';
import { loadProducts, saveProducts } from './productStore.js';
import type { Product } from './types.js';
import { authRouter } from './routes/authRoutes.js';
import { orderRouter } from './routes/orderRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { hubRouter } from './routes/hubRoutes.js';

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

function publicProduct(p: Product) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    price: p.price,
    stockQuantity: p.stockQuantity,
    image: p.image,
    category: p.category,
    description: p.description,
  };
}

app.get('/api/health', async (_req, res) => {
  try {
    await pingDb();
    res.json({ ok: true, database: 'mysql' });
  } catch (e) {
    console.error(e);
    res.status(503).json({ ok: false, error: 'Base de datos no disponible.' });
  }
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
      const pr = mapTiendaNubeProduct(raw);
      if (pr) mapped.push(pr);
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

app.use('/api/auth', authRouter);
app.use('/api/orders', orderRouter);
app.use('/api/admin', adminRouter);
app.use('/api/hub', hubRouter);

const publicDir = path.join(process.cwd(), 'frontend/dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(path.join(publicDir, 'index.html'), (err) => next(err));
  });
}

async function main(): Promise<void> {
  await initDb();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor en el puerto ${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
