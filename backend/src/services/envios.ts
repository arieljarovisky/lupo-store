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

function normalizeArgentinaStateCode(raw: string | null | undefined): string | undefined {
  const v = String(raw ?? '').trim();
  if (!v) return undefined;
  if (/^AR-[A-Z]$/i.test(v)) return v.slice(-1).toUpperCase();
  if (/^[A-Z]$/i.test(v)) return v.toUpperCase();
  const key = v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const map: Record<string, string> = {
    'ciudad autonoma de buenos aires': 'C',
    caba: 'C',
    'buenos aires': 'B',
    catamarca: 'K',
    chaco: 'H',
    chubut: 'U',
    cordoba: 'X',
    corrientes: 'W',
    'entre rios': 'E',
    formosa: 'P',
    jujuy: 'Y',
    'la pampa': 'L',
    'la rioja': 'F',
    mendoza: 'M',
    misiones: 'N',
    neuquen: 'Q',
    'rio negro': 'R',
    salta: 'A',
    'san juan': 'J',
    'san luis': 'D',
    'santa cruz': 'Z',
    'santa fe': 'S',
    'santiago del estero': 'G',
    'tierra del fuego': 'V',
    tucuman: 'T',
  };
  return map[key];
}

function isCabaDestination(city: string | null | undefined, postalCode: string | null | undefined): boolean {
  const c = String(city ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const cp = String(postalCode ?? '').trim().toUpperCase();
  if (c.includes('caba') || c.includes('ciudad autonoma de buenos aires')) return true;
  if (cp.startsWith('C')) return true;
  return false;
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
  destination?: { city?: string | null; state?: string | null };
}): Promise<EnviosRate[]> {
  const token = process.env.ENVIOS_API_TOKEN?.trim();
  if (!token) {
    throw new Error('Falta ENVIOS_API_TOKEN.');
  }
  const country = process.env.ENVIOS_COUNTRY_CODE?.trim() || 'AR';
  const originState =
    normalizeArgentinaStateCode(process.env.ENVIOS_ORIGIN_STATE?.trim()) ||
    process.env.ENVIOS_ORIGIN_STATE?.trim() ||
    undefined;
  const destinationStateRaw =
    normalizeArgentinaStateCode(params.destination?.state) ||
    normalizeArgentinaStateCode(process.env.ENVIOS_DESTINATION_STATE_FALLBACK?.trim()) ||
    params.destination?.state?.trim() ||
    process.env.ENVIOS_DESTINATION_STATE_FALLBACK?.trim() ||
    undefined;
  const destinationState = isCabaDestination(params.destination?.city, params.postalCodeDestination)
    ? 'C'
    : destinationStateRaw;
  const endpoint = process.env.ENVIOS_RATES_PATH?.trim() || '/ship/rate';
  const originName = process.env.ENVIOS_ORIGIN_NAME?.trim();
  const originPhone = process.env.ENVIOS_ORIGIN_PHONE?.trim();
  const originStreet = process.env.ENVIOS_ORIGIN_STREET?.trim();
  const originCity = process.env.ENVIOS_ORIGIN_CITY?.trim();
  if (!originName || !originPhone || !originStreet || !originCity || !originState) {
    throw new Error(
      'Faltan datos de origen para cotizar en Envia (ENVIOS_ORIGIN_NAME, PHONE, STREET, CITY, STATE).'
    );
  }
  const weightKgRaw = Number(params.dimensions.weight) / 1000;
  const weightKg = Number.isFinite(weightKgRaw) && weightKgRaw > 0 ? Number(weightKgRaw.toFixed(2)) : 1;
  const body = {
    origin: {
      name: originName,
      company: process.env.ENVIOS_ORIGIN_COMPANY?.trim() || undefined,
      email: process.env.ENVIOS_ORIGIN_EMAIL?.trim() || undefined,
      phone: originPhone,
      street: originStreet,
      number: process.env.ENVIOS_ORIGIN_NUMBER?.trim() || undefined,
      district: process.env.ENVIOS_ORIGIN_DISTRICT?.trim() || undefined,
      city: originCity,
      state: originState,
      postalCode: params.postalCodeOrigin,
      country,
    },
    destination: {
      name: process.env.ENVIOS_DESTINATION_NAME_FALLBACK?.trim() || 'Cliente',
      city: params.destination?.city?.trim() || undefined,
      state: destinationState,
      postalCode: params.postalCodeDestination,
      country,
      phone: process.env.ENVIOS_DESTINATION_PHONE_FALLBACK?.trim() || undefined,
      street: process.env.ENVIOS_DESTINATION_STREET_FALLBACK?.trim() || undefined,
    },
    packages: [
      {
        weight: weightKg,
        length: params.dimensions.length,
        width: params.dimensions.width,
        height: params.dimensions.height,
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
  if (rows.length === 0) {
    const root = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    const detailCandidate =
      root.message ?? root.error ?? root.detail ?? root.errors ?? root.meta ?? root.data ?? parsed;
    const detailText =
      typeof detailCandidate === 'string'
        ? detailCandidate
        : JSON.stringify(detailCandidate ?? parsed).slice(0, 320);
    throw new Error(`Envios.com no devolvió tarifas. Detalle API: ${detailText}`);
  }
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
