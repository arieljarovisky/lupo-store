import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../pool.js';

export interface TiendaNubeIntegration {
  storeId: string;
  accessToken: string;
  tokenType: string | null;
  scope: string | null;
  userId: string | null;
  connectedAt: string;
}

interface TiendaNubeRow extends RowDataPacket {
  store_id: string;
  access_token: string;
  token_type: string | null;
  scope: string | null;
  user_id: string | null;
  connected_at: Date | string;
}

export async function getTiendaNubeIntegration(): Promise<TiendaNubeIntegration | null> {
  const p = await getPool();
  const [rows] = await p.query<TiendaNubeRow[]>(
    `SELECT store_id, access_token, token_type, scope, user_id, connected_at
       FROM tiendanube_integrations
      WHERE id = 1
      LIMIT 1`
  );
  const r = rows[0];
  if (!r) return null;
  return {
    storeId: r.store_id,
    accessToken: r.access_token,
    tokenType: r.token_type,
    scope: r.scope,
    userId: r.user_id,
    connectedAt:
      r.connected_at instanceof Date ? r.connected_at.toISOString() : String(r.connected_at),
  };
}

export async function upsertTiendaNubeIntegration(input: {
  storeId: string;
  accessToken: string;
  tokenType?: string | null;
  scope?: string | null;
  userId?: string | null;
}): Promise<void> {
  const p = await getPool();
  await p.query(
    `INSERT INTO tiendanube_integrations
      (id, store_id, access_token, token_type, scope, user_id, connected_at)
     VALUES (1, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
      store_id = VALUES(store_id),
      access_token = VALUES(access_token),
      token_type = VALUES(token_type),
      scope = VALUES(scope),
      user_id = VALUES(user_id),
      connected_at = NOW()`,
    [
      input.storeId,
      input.accessToken,
      input.tokenType ?? null,
      input.scope ?? null,
      input.userId ?? null,
    ]
  );
}

export async function clearTiendaNubeIntegration(): Promise<void> {
  const p = await getPool();
  await p.query('DELETE FROM tiendanube_integrations WHERE id = 1');
}
