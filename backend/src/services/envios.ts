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
  total_price?: number | string;
  totalPrice?: number | string;
  delivery_days?: number | string;
  deliveryDays?: number | string;
  days?: number | string;
};

export type EnviosRate = {
  id: string;
  label: string;
  carrier: string;
  cost: number;
  minDays: number;
  maxDays: number;
};

export type EnviosGeneratedLabel = {
  shipmentId: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  carrier: string | null;
  service: string | null;
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

function looksLikeRateRow(value: unknown): value is EnviosRawRate {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    r.price != null ||
    r.amount != null ||
    r.total != null ||
    r.total_price != null ||
    r.totalPrice != null
  );
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
  const out: EnviosRawRate[] = [];
  const stack: unknown[] = [payload];
  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      for (const item of current) {
        if (looksLikeRateRow(item)) out.push(item);
        else stack.push(item);
      }
      continue;
    }
    if (current && typeof current === 'object') {
      const obj = current as Record<string, unknown>;
      if (looksLikeRateRow(obj)) out.push(obj);
      for (const value of Object.values(obj)) {
        if (value && (typeof value === 'object' || Array.isArray(value))) {
          stack.push(value);
        }
      }
    }
  }
  return out;
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
      const cost = parseCurrency(r.price ?? r.amount ?? r.total ?? r.total_price ?? r.totalPrice);
      const est = parsePositiveInt(r.estimated_days ?? r.delivery_days ?? r.deliveryDays ?? r.days, 0);
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

export async function enviosGenerateLabel(params: {
  service: string;
  orderReference: string;
  destination: {
    name: string;
    phone: string;
    email?: string | null;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  packageData: {
    content: string;
    declaredValue: number;
    weight: number;
    height: number;
    width: number;
    length: number;
  };
}): Promise<EnviosGeneratedLabel> {
  const token = process.env.ENVIOS_API_TOKEN?.trim();
  if (!token) throw new Error('Falta ENVIOS_API_TOKEN.');

  const endpoint = process.env.ENVIOS_GENERATE_PATH?.trim() || '/ship/generate';
  const country = process.env.ENVIOS_COUNTRY_CODE?.trim() || 'AR';
  const originName = process.env.ENVIOS_ORIGIN_NAME?.trim();
  const originPhone = process.env.ENVIOS_ORIGIN_PHONE?.trim();
  const originStreet = process.env.ENVIOS_ORIGIN_STREET?.trim();
  const originCity = process.env.ENVIOS_ORIGIN_CITY?.trim();
  const originState = process.env.ENVIOS_ORIGIN_STATE?.trim();
  const originPostalCode = process.env.ENVIOS_POSTAL_CODE_ORIGIN?.trim();
  if (!originName || !originPhone || !originStreet || !originCity || !originState || !originPostalCode) {
    throw new Error(
      'Faltan datos de origen ENVIOS_ORIGIN_* para generar etiqueta (NAME, PHONE, STREET, CITY, STATE, POSTAL_CODE_ORIGIN).'
    );
  }

  const body = {
    origin: {
      name: originName,
      phone: originPhone,
      street: originStreet,
      city: originCity,
      state: originState,
      country,
      postalCode: originPostalCode,
    },
    destination: {
      name: params.destination.name,
      phone: params.destination.phone,
      email: params.destination.email || undefined,
      street: params.destination.address,
      city: params.destination.city,
      state: params.destination.state,
      country: params.destination.country || country,
      postalCode: params.destination.postalCode,
    },
    packages: [
      {
        type: process.env.ENVIOS_PACKAGE_TYPE?.trim() || 'box',
        content: params.packageData.content,
        amount: 1,
        declaredValue: Math.max(0, Math.round(params.packageData.declaredValue)),
        weight: Math.max(1, Math.round(params.packageData.weight)),
        weightUnit: 'g',
        lengthUnit: 'cm',
        dimensions: {
          length: Math.max(1, Math.round(params.packageData.length)),
          width: Math.max(1, Math.round(params.packageData.width)),
          height: Math.max(1, Math.round(params.packageData.height)),
        },
      },
    ],
    shipment: {
      type: 1,
      carrier: process.env.ENVIOS_CARRIER_CODE?.trim() || 'correo_argentino',
      service: params.service,
    },
    settings: {
      comments: `Pedido ${params.orderReference}`,
    },
  };

  const url = `${enviosBaseUrl()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: defaultHeaders(token),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Envios.com (etiqueta): HTTP ${res.status}. ${text.slice(0, 300)}`);
  }

  let parsed: unknown;
  try {
    parsed = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new Error('Envios.com devolvió una respuesta inválida al generar etiqueta.');
  }
  const root = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;

  return {
    shipmentId: data.id != null ? String(data.id) : data.shipment_id != null ? String(data.shipment_id) : null,
    trackingNumber:
      data.trackingNumber != null
        ? String(data.trackingNumber)
        : data.tracking_number != null
          ? String(data.tracking_number)
          : null,
    trackingUrl:
      data.trackingUrl != null ? String(data.trackingUrl) : data.tracking_url != null ? String(data.tracking_url) : null,
    labelUrl: data.label != null ? String(data.label) : data.label_url != null ? String(data.label_url) : null,
    carrier: data.carrier != null ? String(data.carrier) : null,
    service: data.service != null ? String(data.service) : null,
  };
}
