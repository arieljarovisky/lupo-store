import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/jwt.js';
import type { AdminJwtPayload } from '../types.js';

export function optionalCustomerAuth(req: Request, _res: Response, next: NextFunction): void {
  const h = req.header('authorization');
  const raw = h?.startsWith('Bearer ') ? h.slice(7) : undefined;
  if (!raw) {
    next();
    return;
  }
  try {
    const { kind, payload } = verifyToken(raw);
    if (kind === 'customer') {
      (req as Request & { customerId?: number }).customerId = payload.sub;
    }
  } catch {
    /* token inválido: seguimos como invitado */
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const h = req.header('authorization');
  const raw = h?.startsWith('Bearer ') ? h.slice(7) : undefined;
  if (!raw) {
    res.status(401).json({ error: 'Autenticación requerida.' });
    return;
  }
  try {
    const { kind, payload } = verifyToken(raw);
    if (kind !== 'admin') {
      res.status(403).json({ error: 'Solo administradores.' });
      return;
    }
    const adminPayload = payload as AdminJwtPayload;
    (req as Request & { adminId?: number; adminRole?: string }).adminId = adminPayload.sub;
    (req as Request & { adminId?: number; adminRole?: string }).adminRole = adminPayload.role;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido.' });
  }
}

export function requireHubKey(req: Request, res: Response, next: NextFunction): void {
  const key = process.env.HUB_API_KEY?.trim();
  if (!key) {
    res.status(503).json({ error: 'HUB_API_KEY no configurada en el servidor.' });
    return;
  }
  const sent = req.header('x-hub-api-key');
  if (sent !== key) {
    res.status(401).json({ error: 'API key inválida.' });
    return;
  }
  next();
}
