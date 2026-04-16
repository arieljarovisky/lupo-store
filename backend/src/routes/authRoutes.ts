import { Router } from 'express';
import { verifyGoogleIdToken } from '../auth/googleVerify.js';
import { signAdminToken, signCustomerToken } from '../auth/jwt.js';
import { verifyAdminPassword } from '../repos/adminsRepo.js';
import {
  createCustomerWithOAuth,
  findCustomerByOAuth,
} from '../repos/customersRepo.js';

export const authRouter = Router();

authRouter.post('/admin/login', async (req, res) => {
  try {
    const email = String(req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!email || !password) {
      res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
      return;
    }
    const admin = await verifyAdminPassword(email, password);
    if (!admin) {
      res.status(401).json({ error: 'Credenciales incorrectas.' });
      return;
    }
    const token = signAdminToken(admin.id, admin.role);
    res.json({ token, role: admin.role });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo iniciar sesión.' });
  }
});

authRouter.post('/google', async (req, res) => {
  try {
    const idToken = String(req.body?.idToken ?? '').trim();
    if (!idToken) {
      res.status(400).json({ error: 'Falta idToken.' });
      return;
    }
    const g = await verifyGoogleIdToken(idToken);
    let customer = await findCustomerByOAuth('google', g.sub);
    if (!customer) {
      customer = await createCustomerWithOAuth({
        provider: 'google',
        providerUserId: g.sub,
        email: g.email,
        fullName: g.name,
      });
    }
    const token = signCustomerToken(customer.id);
    res.json({ token, customer });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de autenticación';
    res.status(400).json({ error: msg });
  }
});

/** Meta / Facebook: implementar con Graph API y app propia; reservamos el endpoint. */
authRouter.post('/facebook', (_req, res) => {
  res.status(501).json({
    error:
      'Inicio de sesión con Facebook/Instagram requiere FACEBOOK_APP_ID y validación en servidor. Configuración pendiente.',
  });
});
