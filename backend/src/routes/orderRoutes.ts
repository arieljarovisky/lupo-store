import { Router, type Request } from 'express';
import { optionalCustomerAuth } from '../middleware/auth.js';
import { createCheckoutOrder } from '../repos/ordersRepo.js';

export const orderRouter = Router();
orderRouter.use(optionalCustomerAuth);

orderRouter.post('/checkout', async (req, res) => {
  try {
    const body = req.body as {
      items?: { productId: string; quantity: number }[];
      guestEmail?: string;
      guestPhone?: string;
      notes?: string;
    };
    const items = Array.isArray(body.items) ? body.items : [];
    const customerId = (req as Request & { customerId?: number }).customerId;

    const orderId = await createCheckoutOrder({
      items,
      guestEmail: body.guestEmail,
      guestPhone: body.guestPhone,
      notes: body.notes,
      customerId: customerId ?? null,
    });

    res.status(201).json({ ok: true, orderId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo crear el pedido';
    res.status(400).json({ error: msg });
  }
});
