import type { RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { getPool } from '../pool.js';

export async function findAdminByEmail(email: string): Promise<{
  id: number;
  email: string;
  passwordHash: string;
  role: string;
} | null> {
  const p = await getPool();
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT id, email, password_hash, role FROM admins WHERE email = ? LIMIT 1`,
    [email.toLowerCase()]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    email: String(r.email),
    passwordHash: String(r.password_hash),
    role: String(r.role ?? 'admin'),
  };
}

export async function verifyAdminPassword(
  email: string,
  plain: string
): Promise<{ id: number; role: string } | null> {
  const admin = await findAdminByEmail(email);
  if (!admin) return null;
  const ok = await bcrypt.compare(plain, admin.passwordHash);
  if (!ok) return null;
  return { id: admin.id, role: admin.role };
}
