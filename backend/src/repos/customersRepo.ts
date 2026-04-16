import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../pool.js';
import type { Customer } from '../types.js';

export async function findCustomerByOAuth(
  provider: string,
  providerUserId: string
): Promise<Customer | null> {
  const p = await getPool();
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT c.id, c.email, c.phone, c.full_name, c.created_at
     FROM oauth_identities o
     JOIN customers c ON c.id = o.customer_id
     WHERE o.provider = ? AND o.provider_user_id = ?
     LIMIT 1`,
    [provider, providerUserId]
  );
  if (!rows.length) return null;
  return mapCustomer(rows[0]);
}

function mapCustomer(row: RowDataPacket): Customer {
  return {
    id: Number(row.id),
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
    fullName: row.full_name != null ? String(row.full_name) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function createCustomerWithOAuth(params: {
  provider: string;
  providerUserId: string;
  email: string | null;
  fullName: string | null;
}): Promise<Customer> {
  const p = await getPool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO customers (email, phone, full_name) VALUES (?, NULL, ?)`,
      [params.email, params.fullName]
    );
    const insertId = Number(res.insertId);
    await conn.query(
      `INSERT INTO oauth_identities (customer_id, provider, provider_user_id, email_snapshot)
       VALUES (?, ?, ?, ?)`,
      [insertId, params.provider, params.providerUserId, params.email]
    );
    await conn.commit();
    const c = await getCustomerById(insertId);
    if (!c) throw new Error('No se pudo leer el cliente creado');
    return c;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function getCustomerById(id: number): Promise<Customer | null> {
  const p = await getPool();
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT id, email, phone, full_name, created_at FROM customers WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) return null;
  return mapCustomer(rows[0]);
}
