import type { Request, Response, NextFunction } from 'express';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { verifyToken } from '../auth/jwt.js';
import type { AdminJwtPayload } from '../types.js';
import { reserveHubWebhookEvent } from '../repos/hubWebhookEventsRepo.js';

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

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = canonicalizeJson(obj[key]);
    }
    return out;
  }
  return value;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex').toLowerCase();
}

function constantTimeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Firma HMAC para webhooks:
 * - Header x-hub-timestamp: epoch (segundos o ms)
 * - Header x-hub-signature: sha256=<hex> o <hex>
 * - Firma: HMAC_SHA256(HUB_WEBHOOK_SECRET, `${timestamp}.${canonicalJsonBody}`)
 */
export function requireHubWebhookSignature(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.HUB_WEBHOOK_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ error: 'HUB_WEBHOOK_SECRET no configurada en el servidor.' });
    return;
  }

  const timestampRaw = String(req.header('x-hub-timestamp') ?? '').trim();
  const signatureRaw = String(req.header('x-hub-signature') ?? '').trim();
  if (!timestampRaw || !signatureRaw) {
    res.status(401).json({ error: 'Faltan headers x-hub-timestamp/x-hub-signature.' });
    return;
  }

  const tsNum = Number(timestampRaw);
  if (!Number.isFinite(tsNum)) {
    res.status(401).json({ error: 'x-hub-timestamp inválido.' });
    return;
  }
  const tsSec = tsNum > 1e12 ? Math.floor(tsNum / 1000) : Math.floor(tsNum);
  const nowSec = Math.floor(Date.now() / 1000);
  const maxSkew = Math.max(1, Number(process.env.HUB_WEBHOOK_MAX_SKEW_SECONDS ?? 300));
  if (Math.abs(nowSec - tsSec) > maxSkew) {
    res.status(401).json({ error: 'Webhook expirado o fuera de ventana horaria.' });
    return;
  }

  const provided = signatureRaw.toLowerCase().startsWith('sha256=')
    ? signatureRaw.slice(7).trim().toLowerCase()
    : signatureRaw.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) {
    res.status(401).json({ error: 'x-hub-signature inválida.' });
    return;
  }

  const bodyCanonical = JSON.stringify(canonicalizeJson(req.body));
  const signedPayload = `${String(tsSec)}.${bodyCanonical}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex').toLowerCase();
  if (!constantTimeEqualHex(provided, expected)) {
    res.status(401).json({ error: 'Firma HMAC inválida.' });
    return;
  }

  next();
}

/**
 * Idempotencia por header `x-webhook-id` o `x-idempotency-key`.
 * Guarda la reserva del evento en DB antes de procesar.
 */
export async function requireHubWebhookIdempotency(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const idRaw = String(req.header('x-webhook-id') ?? req.header('x-idempotency-key') ?? '').trim();
  if (!idRaw) {
    res.status(400).json({ error: 'Falta header x-webhook-id (o x-idempotency-key).' });
    return;
  }
  if (!/^[A-Za-z0-9:_\-\.]{8,128}$/.test(idRaw)) {
    res.status(400).json({ error: 'x-webhook-id inválido (8-128, alfanumérico + :_-.).' });
    return;
  }

  const endpoint = req.path;
  const payloadCanonical = JSON.stringify(canonicalizeJson(req.body));
  const payloadHash = sha256Hex(payloadCanonical);

  try {
    const reservation = await reserveHubWebhookEvent({
      eventId: idRaw,
      endpoint,
      payloadHash,
    });

    if (reservation.kind === 'duplicate_done') {
      if (!reservation.hashMatches) {
        res.status(409).json({
          error: 'x-webhook-id ya fue usado con otro payload.',
          webhook_id: idRaw,
        });
        return;
      }
      res.status(200).json({
        ok: true,
        duplicate: true,
        webhook_id: idRaw,
        message: 'Evento ya procesado. No se vuelve a aplicar.',
      });
      return;
    }

    if (reservation.kind === 'duplicate_processing') {
      if (!reservation.hashMatches) {
        res.status(409).json({
          error: 'x-webhook-id en procesamiento con payload distinto.',
          webhook_id: idRaw,
        });
        return;
      }
      res.status(409).json({
        error: 'x-webhook-id ya está en procesamiento. Reintentá en unos segundos.',
        webhook_id: idRaw,
      });
      return;
    }

    (req as Request & { hubWebhookEventId?: string }).hubWebhookEventId = idRaw;
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo validar idempotencia del webhook.' });
  }
}
