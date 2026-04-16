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
import { tiendanubePrivacyRouter } from './routes/tiendanubePrivacyRoutes.js';
import { requireAdmin } from './middleware/auth.js';
import {
  buildTiendaNubeAuthorizeUrl,
  createTiendaNubeOAuthStateWithReturn,
  parseTiendaNubeOAuthState,
  exchangeTiendaNubeAuthorizationCode,
} from './tiendanubeOAuth.js';
import {
  clearTiendaNubeIntegration,
  getTiendaNubeIntegration,
  upsertTiendaNubeIntegration,
} from './repos/tiendanubeIntegrationRepo.js';

const PORT = Number(process.env.PORT) || 4000;
const TN_STORE_ID = process.env.TIENDANUBE_STORE_ID?.trim();
const TN_TOKEN = process.env.TIENDANUBE_ACCESS_TOKEN?.trim();
const TN_USER_AGENT = process.env.TIENDANUBE_USER_AGENT?.trim();
const TN_API_VERSION = process.env.TIENDANUBE_API_VERSION?.trim() || '2025-03';

const app = express();
app.use(
  cors({
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-hub-api-key'],
  })
);
app.use(express.json());

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

function adminDashboardUrl(req: express.Request): string {
  const explicit = process.env.ADMIN_DASHBOARD_URL?.trim() || process.env.FRONTEND_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '') + '/admin';
  return `${req.protocol}://${req.get('host')}/admin`;
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

app.get('/api/admin/tiendanube/status', requireAdmin, async (_req, res) => {
  try {
    const dbIntegration = await getTiendaNubeIntegration();
    const envConnected = Boolean(TN_STORE_ID && TN_TOKEN);
    res.json({
      connected: Boolean(dbIntegration) || envConnected,
      source: dbIntegration ? 'oauth' : envConnected ? 'env' : 'none',
      storeId: dbIntegration?.storeId ?? TN_STORE_ID ?? null,
      connectedAt: dbIntegration?.connectedAt ?? null,
      hasOauthConfig: Boolean(
        process.env.TIENDANUBE_CLIENT_ID?.trim() &&
          process.env.TIENDANUBE_CLIENT_SECRET?.trim() &&
          process.env.TIENDANUBE_REDIRECT_URI?.trim()
      ),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo leer el estado de Tienda Nube.' });
  }
});

app.post('/api/admin/tiendanube/oauth/start', requireAdmin, async (req, res) => {
  try {
    const dashboardUrl = String(req.body?.dashboardUrl ?? '').trim();
    const state = createTiendaNubeOAuthStateWithReturn(dashboardUrl || undefined);
    const url = buildTiendaNubeAuthorizeUrl(state);
    res.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo iniciar OAuth.';
    res.status(400).json({ error: msg });
  }
});

app.get('/api/admin/tiendanube/oauth/callback', async (req, res) => {
  let backToAdmin = adminDashboardUrl(req);
  try {
    const code = String(req.query.code ?? '').trim();
    const state = String(req.query.state ?? '').trim();
    if (!code || !state) {
      res.redirect(`${backToAdmin}?tn_oauth=error&message=${encodeURIComponent('Faltan code/state.')}`);
      return;
    }
    const parsedState = parseTiendaNubeOAuthState(state);
    if (parsedState.returnTo) {
      backToAdmin = parsedState.returnTo;
    }
    const oauth = await exchangeTiendaNubeAuthorizationCode(code);
    await upsertTiendaNubeIntegration({
      storeId: oauth.storeId,
      accessToken: oauth.accessToken,
      tokenType: oauth.tokenType,
      scope: oauth.scope,
      userId: oauth.userId,
    });
    res.redirect(`${backToAdmin}?tn_oauth=ok&store=${encodeURIComponent(oauth.storeId)}`);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : 'No se pudo completar OAuth.';
    res.redirect(`${backToAdmin}?tn_oauth=error&message=${encodeURIComponent(msg)}`);
  }
});

app.delete('/api/admin/tiendanube/connection', requireAdmin, async (_req, res) => {
  try {
    await clearTiendaNubeIntegration();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo desconectar Tienda Nube.' });
  }
});

app.post('/api/admin/import/tiendanube', requireAdmin, async (_req, res) => {
  const integration = await getTiendaNubeIntegration();
  const storeId = integration?.storeId || TN_STORE_ID;
  const accessToken = integration?.accessToken || TN_TOKEN;
  const userAgent = TN_USER_AGENT || 'LupoStore (admin@localhost)';

  if (!storeId || !accessToken) {
    res.status(400).json({
      error:
        'No hay conexión con Tienda Nube. Conectá tu tienda por OAuth desde el panel admin o definí TIENDANUBE_STORE_ID + TIENDANUBE_ACCESS_TOKEN.',
    });
    return;
  }

  try {
    const rawList = await fetchAllProductsFromTiendaNube({
      storeId,
      accessToken,
      userAgent,
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
app.use('/api/tiendanube/privacy', tiendanubePrivacyRouter);

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
