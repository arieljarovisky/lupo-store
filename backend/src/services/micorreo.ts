/**
 * Cliente MiCorreo (Correo Argentino) — token JWT, cotización /rates y sucursales /agencies.
 * Credenciales solo por variables de entorno en el backend.
 */

const DEFAULT_BASE = 'https://apitest.correoargentino.com.ar/micorreo/v1';

export function micorreoIsConfigured(): boolean {
  const u = process.env.MICORREO_USER?.trim();
  const p = process.env.MICORREO_PASSWORD?.trim();
  const cid = process.env.MICORREO_CUSTOMER_ID?.trim();
  const origin = process.env.MICORREO_POSTAL_CODE_ORIGIN?.trim();
  return Boolean(u && p && cid && origin);
}

export function micorreoBaseUrl(): string {
  const raw = process.env.MICORREO_API_BASE?.trim().replace(/\/$/, '');
  return raw || DEFAULT_BASE;
}

type TokenCache = { token: string; expiresAtMs: number };
let tokenCache: TokenCache | null = null;

function decodeJwtExpMs(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = JSON.parse(Buffer.from(b64 + pad, 'base64').toString('utf8')) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function getMicorreoJwt(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs > now + 15_000) {
    return tokenCache.token;
  }
  const user = process.env.MICORREO_USER?.trim();
  const pass = process.env.MICORREO_PASSWORD?.trim();
  if (!user || !pass) {
    throw new Error('Faltan MICORREO_USER y MICORREO_PASSWORD.');
  }
  const url = `${micorreoBaseUrl()}/token`;
  const basic = Buffer.from(`${user}:${pass}`).toString('base64');
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Basic ${basic}` } });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`MiCorreo (token): HTTP ${res.status}. ${text.slice(0, 240)}`);
  }
  const json = JSON.parse(text) as { token?: string; message?: string };
  if (!json.token) {
    throw new Error(json.message || 'MiCorreo: la respuesta del token no incluye JWT.');
  }
  const fromJwt = decodeJwtExpMs(json.token);
  const expiresAtMs = fromJwt ? fromJwt - 30_000 : now + 50 * 60_000;
  tokenCache = { token: json.token, expiresAtMs };
  return json.token;
}

export type MicorreoDimensions = {
  weight: number;
  height: number;
  width: number;
  length: number;
};

export type MicorreoRateRow = {
  deliveredType: string;
  productType: string;
  productName: string;
  price: number;
  deliveryTimeMin: string;
  deliveryTimeMax: string;
};

export async function micorreoFetchRates(params: {
  postalCodeOrigin: string;
  postalCodeDestination: string;
  deliveredType?: 'D' | 'S';
  dimensions: MicorreoDimensions;
}): Promise<MicorreoRateRow[]> {
  const customerId = process.env.MICORREO_CUSTOMER_ID?.trim();
  if (!customerId) throw new Error('Falta MICORREO_CUSTOMER_ID.');

  const token = await getMicorreoJwt();
  const body: Record<string, unknown> = {
    customerId,
    postalCodeOrigin: params.postalCodeOrigin,
    postalCodeDestination: params.postalCodeDestination,
    dimensions: params.dimensions,
  };
  if (params.deliveredType) {
    body.deliveredType = params.deliveredType;
  }

  const res = await fetch(`${micorreoBaseUrl()}/rates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 280);
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j.message) detail = j.message;
    } catch {
      /* ignore */
    }
    throw new Error(`MiCorreo (cotización): ${detail}`);
  }
  const json = JSON.parse(text) as { rates?: MicorreoRateRow[] };
  return Array.isArray(json.rates) ? json.rates : [];
}

export type MicorreoAgencyRow = {
  code: string;
  name: string;
  location?: {
    address?: {
      streetName?: string | null;
      streetNumber?: string | null;
      locality?: string | null;
      postalCode?: string | null;
    };
  };
};

export async function micorreoFetchAgencies(provinceCode: string): Promise<MicorreoAgencyRow[]> {
  const customerId = process.env.MICORREO_CUSTOMER_ID?.trim();
  if (!customerId) throw new Error('Falta MICORREO_CUSTOMER_ID.');

  const pc = provinceCode.trim().toUpperCase();
  if (!/^[A-Z]{1,2}$/.test(pc)) {
    throw new Error('Código de provincia inválido (usá la letra del CPA, ej. B, C).');
  }

  const token = await getMicorreoJwt();
  const url = new URL(`${micorreoBaseUrl()}/agencies`);
  url.searchParams.set('customerId', customerId);
  url.searchParams.set('provinceCode', pc);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 280);
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j.message) detail = j.message;
    } catch {
      /* ignore */
    }
    throw new Error(`MiCorreo (sucursales): ${detail}`);
  }
  const json = JSON.parse(text) as unknown;
  if (!Array.isArray(json)) {
    return [];
  }
  return json as MicorreoAgencyRow[];
}

export function micorreoDefaultDimensions(): MicorreoDimensions {
  const weight = Math.max(1, Math.min(25_000, Math.round(Number(process.env.MICORREO_PACKAGE_WEIGHT_G ?? '1000') || 1000)));
  const height = Math.max(1, Math.min(150, Math.round(Number(process.env.MICORREO_PACKAGE_HEIGHT_CM ?? '10') || 10)));
  const width = Math.max(1, Math.min(150, Math.round(Number(process.env.MICORREO_PACKAGE_WIDTH_CM ?? '20') || 20)));
  const length = Math.max(1, Math.min(150, Math.round(Number(process.env.MICORREO_PACKAGE_LENGTH_CM ?? '30') || 30)));
  return { weight, height, width, length };
}
