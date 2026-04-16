import { OAuth2Client } from 'google-auth-library';

export async function verifyGoogleIdToken(idToken: string): Promise<{
  sub: string;
  email: string | null;
  name: string | null;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID no está configurado en el servidor.');
  }
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });
  const p = ticket.getPayload();
  if (!p?.sub) {
    throw new Error('Token de Google inválido.');
  }
  return {
    sub: p.sub,
    email: p.email ?? null,
    name: p.name ?? null,
  };
}
