import type { Product } from '../context/CartContext';

/** Base del API: Vite (build), o window.__LUPO_API_BASE__ en runtime, o mismo origen. */
export function apiBase(): string {
  if (typeof window !== 'undefined' && window.__LUPO_API_BASE__?.trim()) {
    return window.__LUPO_API_BASE__.trim().replace(/\/$/, '');
  }
  const b = import.meta.env.VITE_API_URL?.trim();
  return b ? b.replace(/\/$/, '') : '';
}

function apiErrorMessage(res: Response, bodyText: string): string {
  const ct = res.headers.get('content-type') || '';
  if (res.status === 404 || (!ct.includes('application/json') && bodyText.length > 0)) {
    if (
      bodyText.includes('NOT_FOUND') ||
      bodyText.includes('could not be found') ||
      bodyText.includes('<!DOCTYPE') ||
      bodyText.includes('<html')
    ) {
      return (
        'No hay API en este dominio (respuesta 404/HTML). Si el sitio está en Vercel u otro host ' +
        'y el backend en Railway, configurá la variable VITE_API_URL con la URL pública del backend ' +
        'antes de hacer npm run build, o definí window.__LUPO_API_BASE__ en index.html.'
      );
    }
  }
  if (ct.includes('application/json')) {
    try {
      const j = JSON.parse(bodyText) as { error?: string };
      if (j?.error) return j.error;
    } catch {
      /* ignore */
    }
  }
  const short = bodyText.length > 200 ? `${bodyText.slice(0, 200)}…` : bodyText;
  return short || `HTTP ${res.status}`;
}

export async function fetchProducts(): Promise<Product[]> {
  const url = `${apiBase()}/api/products`;
  const res = await fetch(url);
  const text = await res.text();
  const ct = res.headers.get('content-type') || '';

  if (!res.ok) {
    throw new Error(apiErrorMessage(res, text));
  }
  if (!ct.includes('application/json')) {
    throw new Error(
      'El servidor no devolvió JSON. Revisá la URL del API (VITE_API_URL / mismo origen con Express).'
    );
  }
  return JSON.parse(text) as Product[];
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
  const text = await res.text();
  let data: { ok?: boolean; imported?: number; message?: string; error?: string } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    return { ok: false, imported: 0, error: apiErrorMessage(res, text) };
  }
  if (!res.ok) {
    return { ok: false, imported: 0, error: data.error || `HTTP ${res.status}` };
  }
  return {
    ok: true,
    imported: data.imported ?? 0,
    message: data.message,
  };
}
