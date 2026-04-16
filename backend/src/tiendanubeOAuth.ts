import crypto from 'node:crypto';

const DEFAULT_AUTHORIZE_URL = 'https://www.tiendanube.com/apps/authorize';
const DEFAULT_TOKEN_URL = 'https://www.tiendanube.com/apps/authorize/token';

interface OAuthStatePayload {
  typ: 'tn_oauth_state';
  nonce: string;
  iat: number;
}

function stateSecret(): string {
  const base = process.env.JWT_SECRET?.trim() || process.env.TIENDANUBE_CLIENT_SECRET?.trim();
  if (!base) {
    throw new Error(
      'Falta JWT_SECRET (o TIENDANUBE_CLIENT_SECRET) para firmar el estado OAuth de Tienda Nube.'
    );
  }
  return base;
}

function b64(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64url');
}

function b64json(obj: unknown): string {
  return b64(JSON.stringify(obj));
}

function signState(payload: OAuthStatePayload): string {
  const body = b64json(payload);
  const sig = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyState(raw: string): OAuthStatePayload {
  const [body, sig] = raw.split('.');
  if (!body || !sig) throw new Error('state inválido');
  const expected = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  if (sig !== expected) throw new Error('state inválido');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as OAuthStatePayload;
  if (payload.typ !== 'tn_oauth_state') throw new Error('state inválido');
  const ageSec = Math.floor(Date.now() / 1000) - Number(payload.iat || 0);
  if (ageSec < 0 || ageSec > 15 * 60) throw new Error('state expirado');
  return payload;
}

export function createTiendaNubeOAuthState(): string {
  return signState({
    typ: 'tn_oauth_state',
    nonce: crypto.randomBytes(12).toString('hex'),
    iat: Math.floor(Date.now() / 1000),
  });
}

export function assertValidTiendaNubeOAuthState(state: string): void {
  verifyState(state);
}

export function resolveTiendaNubeOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
} {
  const clientId = process.env.TIENDANUBE_CLIENT_ID?.trim();
  const clientSecret = process.env.TIENDANUBE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.TIENDANUBE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Falta configuración OAuth de Tienda Nube. Definí TIENDANUBE_CLIENT_ID, TIENDANUBE_CLIENT_SECRET y TIENDANUBE_REDIRECT_URI.'
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    authorizeUrl: process.env.TIENDANUBE_AUTHORIZE_URL?.trim() || DEFAULT_AUTHORIZE_URL,
    tokenUrl: process.env.TIENDANUBE_TOKEN_URL?.trim() || DEFAULT_TOKEN_URL,
  };
}

export function buildTiendaNubeAuthorizeUrl(state: string): string {
  const cfg = resolveTiendaNubeOAuthConfig();
  const u = new URL(cfg.authorizeUrl);
  u.searchParams.set('client_id', cfg.clientId);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', cfg.redirectUri);
  u.searchParams.set('state', state);
  return u.toString();
}

export async function exchangeTiendaNubeAuthorizationCode(code: string): Promise<{
  accessToken: string;
  tokenType: string | null;
  scope: string | null;
  storeId: string;
  userId: string | null;
}> {
  const cfg = resolveTiendaNubeOAuthConfig();
  const body = {
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'authorization_code',
    code,
  };

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OAuth Tienda Nube ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = JSON.parse(text) as Record<string, unknown>;
  const accessToken = String(data.access_token ?? '').trim();
  if (!accessToken) throw new Error('OAuth Tienda Nube: respuesta sin access_token.');

  const storeRaw =
    data.user_id ?? data.store_id ?? data.account_id ?? data.accountid ?? data.storeId;
  const storeId = String(storeRaw ?? '').trim();
  if (!storeId) {
    throw new Error(
      'OAuth Tienda Nube: no llegó user_id/store_id en la respuesta. Revisá alcance y app OAuth.'
    );
  }

  return {
    accessToken,
    tokenType: data.token_type ? String(data.token_type) : null,
    scope: data.scope ? String(data.scope) : null,
    storeId,
    userId: data.user_id ? String(data.user_id) : null,
  };
}
