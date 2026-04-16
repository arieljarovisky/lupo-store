import type { Product } from '../context/CartContext';

/**
 * Sin `https://` o `http://`, `fetch` interpreta el valor como ruta relativa al sitio actual
 * (p. ej. `mi-app.vercel.app/tu-dominio.railway.app/api/...` → 404/HTML).
 */
function normalizeApiBase(raw: string): string {
  const s = raw.trim().replace(/\/$/, '');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return s;
  if (/^(localhost|127\.0\.0\.1)(\b|$|:)/i.test(s)) {
    return `http://${s}`;
  }
  return `https://${s}`;
}

/** Base del API: Vite (build), o window.__LUPO_API_BASE__ en runtime, o mismo origen. */
export function apiBase(): string {
  if (typeof window !== 'undefined' && window.__LUPO_API_BASE__?.trim()) {
    return normalizeApiBase(window.__LUPO_API_BASE__);
  }
  const b = import.meta.env.VITE_API_URL?.trim();
  return b ? normalizeApiBase(b) : '';
}

/** URL de comprobación del backend (misma base que el catálogo). */
export function apiHealthUrl(): string {
  const base = apiBase();
  if (base) return `${base}/api/health`;
  if (typeof window !== 'undefined') return `${window.location.origin}/api/health`;
  return '/api/health';
}

function networkFetchErrorMessage(url: string, err: TypeError): string {
  return (
    `No se pudo conectar (${err.message}). URL: ${url}. ` +
    `Abrí en el navegador ${apiHealthUrl()}: si no ves JSON con "ok", el backend no responde o la base del API es incorrecta. ` +
    `Si el front está en otro dominio, verificá VITE_API_URL (https://…), redeploy tras cambiarla, y revisá CORS o contenido mixto (HTTPS vs HTTP).`
  );
}

const ADMIN_TOKEN_KEY = 'lupo_admin_token';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getAdminToken(): string | null {
  if (!canUseStorage()) return null;
  const token = window.localStorage.getItem(ADMIN_TOKEN_KEY)?.trim();
  return token || null;
}

export function setAdminToken(token: string): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
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
  const base = apiBase();
  const url = base ? `${base}/api/products` : '/api/products';
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(networkFetchErrorMessage(url, e));
    }
    throw e;
  }
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

export async function adminLogin(email: string, password: string): Promise<{
  ok: boolean;
  token?: string;
  role?: string;
  error?: string;
}> {
  const base = apiBase();
  const loginUrl = base ? `${base}/api/auth/admin/login` : '/api/auth/admin/login';
  let res: Response;
  try {
    res = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (e) {
    if (e instanceof TypeError) {
      return { ok: false, error: networkFetchErrorMessage(loginUrl, e) };
    }
    throw e;
  }

  const text = await res.text();
  let data: { token?: string; role?: string; error?: string } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    return { ok: false, error: apiErrorMessage(res, text) };
  }
  if (!res.ok || !data.token) {
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  }

  setAdminToken(data.token);
  return { ok: true, token: data.token, role: data.role };
}

function adminAuthHeaders(): Record<string, string> {
  const token = getAdminToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function getTiendaNubeConnectionStatus(): Promise<{
  connected: boolean;
  source: 'oauth' | 'env' | 'none';
  storeId: string | null;
  connectedAt: string | null;
  hasOauthConfig: boolean;
  error?: string;
}> {
  const base = apiBase();
  const url = base ? `${base}/api/admin/tiendanube/status` : '/api/admin/tiendanube/status';
  try {
    const res = await fetch(url, { headers: adminAuthHeaders() });
    const text = await res.text();
    const data = JSON.parse(text) as {
      connected?: boolean;
      source?: 'oauth' | 'env' | 'none';
      storeId?: string | null;
      connectedAt?: string | null;
      hasOauthConfig?: boolean;
      error?: string;
    };
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) clearAdminToken();
      return {
        connected: false,
        source: 'none',
        storeId: null,
        connectedAt: null,
        hasOauthConfig: false,
        error: data.error || `HTTP ${res.status}`,
      };
    }
    return {
      connected: Boolean(data.connected),
      source: data.source ?? 'none',
      storeId: data.storeId ?? null,
      connectedAt: data.connectedAt ?? null,
      hasOauthConfig: Boolean(data.hasOauthConfig),
    };
  } catch (e) {
    if (e instanceof TypeError) {
      return {
        connected: false,
        source: 'none',
        storeId: null,
        connectedAt: null,
        hasOauthConfig: false,
        error: networkFetchErrorMessage(url, e),
      };
    }
    throw e;
  }
}

export async function startTiendaNubeOAuth(): Promise<{ ok: boolean; url?: string; error?: string }> {
  const base = apiBase();
  const url = base ? `${base}/api/admin/tiendanube/oauth/start` : '/api/admin/tiendanube/oauth/start';
  const dashboardUrl =
    typeof window !== 'undefined' ? `${window.location.origin.replace(/\/$/, '')}/admin` : undefined;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: adminAuthHeaders(),
      body: JSON.stringify({ dashboardUrl }),
    });
    const text = await res.text();
    const data = JSON.parse(text) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      if (res.status === 401 || res.status === 403) clearAdminToken();
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true, url: data.url };
  } catch (e) {
    if (e instanceof TypeError) return { ok: false, error: networkFetchErrorMessage(url, e) };
    throw e;
  }
}

export async function disconnectTiendaNube(): Promise<{ ok: boolean; error?: string }> {
  const base = apiBase();
  const url = base ? `${base}/api/admin/tiendanube/connection` : '/api/admin/tiendanube/connection';
  try {
    const res = await fetch(url, { method: 'DELETE', headers: adminAuthHeaders() });
    const text = await res.text();
    const data = text ? (JSON.parse(text) as { error?: string }) : {};
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) clearAdminToken();
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof TypeError) return { ok: false, error: networkFetchErrorMessage(url, e) };
    throw e;
  }
}

export async function importFromTiendaNube(): Promise<{
  ok: boolean;
  imported: number;
  message?: string;
  error?: string;
}> {
  const headers: Record<string, string> = adminAuthHeaders();

  const base = apiBase();
  const importUrl = base ? `${base}/api/admin/import/tiendanube` : '/api/admin/import/tiendanube';
  let res: Response;
  try {
    res = await fetch(importUrl, {
      method: 'POST',
      headers,
    });
  } catch (e) {
    if (e instanceof TypeError) {
      return { ok: false, imported: 0, error: networkFetchErrorMessage(importUrl, e) };
    }
    throw e;
  }
  const text = await res.text();
  let data: { ok?: boolean; imported?: number; message?: string; error?: string } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    return { ok: false, imported: 0, error: apiErrorMessage(res, text) };
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      clearAdminToken();
    }
    return { ok: false, imported: 0, error: data.error || `HTTP ${res.status}` };
  }
  return {
    ok: true,
    imported: data.imported ?? 0,
    message: data.message,
  };
}
