import jwt from 'jsonwebtoken';
import type { AdminJwtPayload, CustomerJwtPayload } from '../types.js';

function secret(): string {
  const s = process.env.JWT_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Definí JWT_SECRET en producción.');
  }
  return 'dev-only-insecure-secret';
}

export function signCustomerToken(customerId: number): string {
  const payload: CustomerJwtPayload = { typ: 'customer', sub: customerId };
  return jwt.sign(payload, secret(), { expiresIn: '30d' });
}

export function signAdminToken(adminId: number, role: string): string {
  const payload: AdminJwtPayload = { typ: 'admin', sub: adminId, role };
  return jwt.sign(payload, secret(), { expiresIn: '7d' });
}

function numSub(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

export function verifyToken(token: string): {
  kind: 'customer' | 'admin';
  payload: CustomerJwtPayload | AdminJwtPayload;
} {
  const decoded = jwt.verify(token, secret()) as Record<string, unknown>;
  const typ = decoded.typ;
  const sub = numSub(decoded.sub);
  if (sub == null) throw new Error('Token inválido');
  if (typ === 'customer') {
    return { kind: 'customer', payload: { typ: 'customer', sub } };
  }
  if (typ === 'admin') {
    const role = typeof decoded.role === 'string' ? decoded.role : 'admin';
    return { kind: 'admin', payload: { typ: 'admin', sub, role } };
  }
  throw new Error('Token inválido');
}
