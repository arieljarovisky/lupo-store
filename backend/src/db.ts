import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { runMigrations } from './migrate.js';
import { replaceAllProducts } from './repos/productsRepo.js';
import { seedProducts } from './seed.js';
import type { Product } from './types.js';
import { getPool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

async function maybeMigrateFromLegacyJson(): Promise<void> {
  const p = await getPool();
  const [countRows] = await p.query<RowDataPacket[]>('SELECT COUNT(*) AS c FROM products');
  const count = Number(countRows[0]?.c ?? 0);
  if (count > 0) return;

  const legacyPath = path.join(dataDir, 'products.json');
  if (fs.existsSync(legacyPath)) {
    try {
      const raw = fs.readFileSync(legacyPath, 'utf-8');
      const parsed = JSON.parse(raw) as Product[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.map(normalizeLegacyProduct);
        await replaceAllProducts(normalized);
        console.log(
          '[db] Catálogo migrado desde products.json (%d productos). Podés borrar el JSON si querés.',
          normalized.length
        );
        return;
      }
    } catch (e) {
      console.warn('[db] No se pudo leer products.json:', e);
    }
  }

  await replaceAllProducts(seedProducts);
  console.log('[db] Catálogo inicial cargado (datos de ejemplo).');
}

function normalizeLegacyProduct(p: Product): Product {
  return {
    ...p,
    stockQuantity: p.stockQuantity ?? 0,
    syncSource: p.syncSource ?? 'manual',
  };
}

async function seedAdminIfNeeded(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim();
  const plain = process.env.ADMIN_PASSWORD?.trim();
  if (!email || !plain) {
    console.warn(
      '[db] ADMIN_EMAIL / ADMIN_PASSWORD no definidos: no se creó usuario admin automático.'
    );
    return;
  }

  const p = await getPool();
  const [rows] = await p.query<RowDataPacket[]>('SELECT COUNT(*) AS c FROM admins');
  if (Number(rows[0]?.c ?? 0) > 0) return;

  const hash = await bcrypt.hash(plain, 10);
  await p.query(
    'INSERT INTO admins (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
    [email.toLowerCase(), hash, 'Administrador', 'admin']
  );
  console.log('[db] Usuario admin creado desde ADMIN_EMAIL.');
}

export async function initDb(): Promise<void> {
  const p = await getPool();
  await runMigrations(p);
  await maybeMigrateFromLegacyJson();
  await seedAdminIfNeeded();
}

export async function pingDb(): Promise<void> {
  const p = await getPool();
  await p.query('SELECT 1');
}
