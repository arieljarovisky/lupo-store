import type { Product } from '../context/CartContext';

function apiBase(): string {
  const b = import.meta.env.VITE_API_URL?.trim();
  return b ? b.replace(/\/$/, '') : '';
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${apiBase()}/api/products`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<Product[]>;
}

export async function importFromTiendaNube(): Promise<{
  ok: boolean;
  imported: number;
  message?: string;
  error?: string;
}> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const key = import.meta.env.VITE_IMPORT_API_KEY?.trim();
  if (key) headers['x-import-key'] = key;

  const res = await fetch(`${apiBase()}/api/admin/import/tiendanube`, {
    method: 'POST',
    headers,
  });
  const data = (await res.json()) as {
    ok?: boolean;
    imported?: number;
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, imported: 0, error: data.error || `HTTP ${res.status}` };
  }
  return {
    ok: true,
    imported: data.imported ?? 0,
    message: data.message,
  };
}
