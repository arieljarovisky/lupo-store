import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../pool.js';

export type HubWebhookReservation =
  | { kind: 'reserved' }
  | { kind: 'duplicate_done'; hashMatches: boolean }
  | { kind: 'duplicate_processing'; hashMatches: boolean };

export async function reserveHubWebhookEvent(input: {
  eventId: string;
  endpoint: string;
  payloadHash: string;
}): Promise<HubWebhookReservation> {
  const p = await getPool();
  const [ins] = await p.query<ResultSetHeader>(
    `INSERT IGNORE INTO hub_webhook_events (event_id, endpoint, payload_hash, status)
     VALUES (?, ?, ?, 'processing')`,
    [input.eventId, input.endpoint, input.payloadHash]
  );
  if (ins.affectedRows === 1) return { kind: 'reserved' };

  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT status, payload_hash
     FROM hub_webhook_events
     WHERE event_id = ?
     LIMIT 1`,
    [input.eventId]
  );
  const row = rows[0];
  const status = String(row?.status ?? 'processing');
  const hash = String(row?.payload_hash ?? '');
  const hashMatches = hash === input.payloadHash;

  if (status === 'done') return { kind: 'duplicate_done', hashMatches };
  return { kind: 'duplicate_processing', hashMatches };
}

export async function markHubWebhookEventDone(eventId: string): Promise<void> {
  const p = await getPool();
  await p.query(
    `UPDATE hub_webhook_events
     SET status = 'done', processed_at = NOW()
     WHERE event_id = ?`,
    [eventId]
  );
}

/**
 * Si el handler falla, liberamos la reserva para que el ERP pueda reintentar
 * con el mismo webhook-id sin quedar bloqueado en "processing".
 */
export async function releaseHubWebhookEventReservation(eventId: string): Promise<void> {
  const p = await getPool();
  await p.query(
    `DELETE FROM hub_webhook_events
     WHERE event_id = ? AND status = 'processing'`,
    [eventId]
  );
}
