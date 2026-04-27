type EnviosRawRate = {
  id?: string | number;
  service_id?: string | number;
  service?: string;
  name?: string;
  carrier?: string;
  provider?: string;
  price?: number | string;
  amount?: number | string;
  total?: number | string;
  min_days?: number | string;
  max_days?: number | string;
  estimated_days?: number | string;
};

export type EnviosRate = {
  id: string;
  label: string;
  carrier: string;
  cost: number;
  minDays: number;
  maxDays: number;
};

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/$/, '');
}

function parsePositiveInt(raw: unknown, fallback: number): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseCurrency(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function defaultHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export function enviosIsConfigured(): boolean {
  const token = process.env.ENVIOS_API_TOKEN?.trim();
  const origin = process.env.ENVIOS_POSTAL_CODE_ORIGIN?.trim();
  return Boolean(token && origin);
}

export function enviosBaseUrl(): string {
  const raw = process.env.ENVIOS_API_BASE?.trim();
  if (!raw) return 'https://api.envia.com';
  return normalizeBaseUrl(raw);
}

export function enviosDefaultDimensions(): { weight: number; height: number; width: number; length: number } {
  const weight = parsePositiveInt(process.env.ENVIOS_PACKAGE_WEIGHT_G, 1000);
  const height = parsePositiveInt(process.env.ENVIOS_PACKAGE_HEIGHT_CM, 10);
  const width = parsePositiveInt(process.env.ENVIOS_PACKAGE_WIDTH_CM, 20);
  const length = parsePositiveInt(process.env.ENVIOS_PACKAGE_LENGTH_CM, 30);
  return { weight, height, width, length };
}

function normalizeRates(payload: unknown): EnviosRawRate[] {
  if (Array.isArray(payload)) return payload as EnviosRawRate[];
  if (payload && typeof payload === 'object') {
    const maybe = payload as { data?: unknown; rates?: unknown; quotes?: unknown };
    if (Array.isArray(maybe.data)) return maybe.data as EnviosRawRate[];
    if (Array.isArray(maybe.rates)) return maybe.rates as EnviosRawRate[];
    if (Array.isArray(maybe.quotes)) return maybe.quotes as EnviosRawRate[];
  }
  return [];
}

export async function enviosFetchRates(params: {
  postalCodeOrigin: string;
  postalCodeDestination: string;
  dimensions: { weight: number; height: number; width: number; length: number };
}): Promise<EnviosRate[]> {
  const token = process.env.ENVIOS_API_TOKEN?.trim();
  if (!token) {
    throw new Error('Falta ENVIOS_API_TOKEN.');
  }
  const country = process.env.ENVIOS_COUNTRY_CODE?.trim() || 'AR';
  const endpoint = process.env.ENVIOS_RATES_PATH?.trim() || '/ship/rate';
  const body = {
    origin: {
      postalCode: params.postalCodeOrigin,
      country,
    },
    destination: {
      postalCode: params.postalCodeDestination,
      country,
    },
    packages: [
      {
        content: process.env.ENVIOS_PACKAGE_CONTENT?.trim() || 'Ropa',
        amount: 1,
        type: process.env.ENVIOS_PACKAGE_TYPE?.trim() || 'box',
        dimensions: params.dimensions,
      },
    ],
  };

  const url = `${enviosBaseUrl()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: defaultHeaders(token),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Envios.com (cotización): HTTP ${res.status}. ${text.slice(0, 260)}`);
  }

  let parsed: unknown = null;
  try {
    parsed = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new Error('Envios.com devolvió una respuesta inválida (no JSON).');
  }
  const rows = normalizeRates(parsed);
  return rows
    .map((r, index) => {
      const id = String(r.id ?? r.service_id ?? `envios_${index + 1}`);
      const service = String(r.service ?? r.name ?? 'Servicio estándar');
      const carrier = String(r.carrier ?? r.provider ?? 'envios.com');
      const cost = parseCurrency(r.price ?? r.amount ?? r.total);
      const est = parsePositiveInt(r.estimated_days, 0);
      const minDays = parsePositiveInt(r.min_days, est || 1);
      const maxDays = parsePositiveInt(r.max_days, Math.max(minDays, est || minDays));
      return {
        id,
        label: `${carrier} - ${service}`,
        carrier,
        cost,
        minDays,
        maxDays: Math.max(minDays, maxDays),
      };
    })
    .filter((r) => r.cost >= 0);
}
