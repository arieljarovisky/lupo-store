import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { requireAdmin } from '../middleware/auth.js';
import { cancelOrderAndRestoreStock, listOrdersForAdmin } from '../repos/ordersRepo.js';
import { updateProductOrVariantPrice } from '../repos/productsRepo.js';
import { getPool } from '../pool.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.patch('/products/:productId/price', async (req, res) => {
  try {
    const productId = String(req.params.productId ?? '').trim();
    const body = req.body as { price?: unknown; variantId?: unknown; applyToAllVariants?: unknown };
    const price = Number(body.price);
    const variantId =
      body.variantId != null && String(body.variantId).trim() !== ''
        ? String(body.variantId).trim()
        : null;
    const applyToAllVariants = Boolean(body.applyToAllVariants);
    await updateProductOrVariantPrice({ productId, price, variantId, applyToAllVariants });
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo actualizar el precio.';
    res.status(400).json({ error: msg });
  }
});

adminRouter.get('/orders', async (_req, res) => {
  try {
    const orders = await listOrdersForAdmin(200);
    res.json(orders);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudieron listar los pedidos.' });
  }
});

adminRouter.post('/orders/:orderId/cancel', async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      res.status(400).json({ error: 'Pedido inválido.' });
      return;
    }
    await cancelOrderAndRestoreStock(orderId);
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo cancelar el pedido.';
    res.status(400).json({ error: msg });
  }
});

adminRouter.get('/customers', async (_req, res) => {
  try {
    const p = await getPool();
    const [rows] = await p.query<RowDataPacket[]>(
      `SELECT id, email, phone, full_name, created_at FROM customers ORDER BY created_at DESC LIMIT 500`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudieron listar los clientes.' });
  }
});
