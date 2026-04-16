import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { requireAdmin } from '../middleware/auth.js';
import { listOrdersForAdmin } from '../repos/ordersRepo.js';
import { getPool } from '../pool.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get('/orders', async (_req, res) => {
  try {
    const orders = await listOrdersForAdmin(200);
    res.json(orders);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudieron listar los pedidos.' });
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
