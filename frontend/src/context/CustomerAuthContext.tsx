import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  clearCustomerToken,
  customerLoginWithGoogleIdToken,
  getCustomerToken,
  type CustomerSession,
} from '../lib/api';

interface CustomerAuthContextValue {
  customer: CustomerSession | null;
  loading: boolean;
  authError: string | null;
  mountGoogleButton: (container: HTMLDivElement) => void;
  logout: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

function decodeJwtPayload(token: string): { sub?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(window.atob(parts[1])) as { sub?: number };
    return payload;
  } catch {
    return null;
  }
}

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google Identity.')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity.'));
    document.body.appendChild(script);
  });
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const googleReadyRef = useRef(false);

  useEffect(() => {
    const token = getCustomerToken();
    if (!token) return;
    const payload = decodeJwtPayload(token);
    if (!payload?.sub) {
      clearCustomerToken();
      return;
    }
    setCustomer({
      id: Number(payload.sub),
      email: null,
      phone: null,
      fullName: null,
      createdAt: '',
    });
  }, []);

  const ensureGoogleInit = useCallback(async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    if (!clientId) throw new Error('Falta VITE_GOOGLE_CLIENT_ID en el frontend.');
    await loadGoogleIdentityScript();
    if (!window.google?.accounts?.id) throw new Error('Google Identity no está disponible.');
    if (googleReadyRef.current) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: { credential?: string }) => {
        const credential = String(response.credential ?? '').trim();
        if (!credential) {
          setAuthError('Google no devolvió credencial de acceso.');
          return;
        }
        setLoading(true);
        setAuthError(null);
        const result = await customerLoginWithGoogleIdToken(credential);
        setLoading(false);
        if (!result.ok) {
          setAuthError(result.error);
          return;
        }
        setCustomer(result.customer);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
    });
    googleReadyRef.current = true;
  }, []);

  const mountGoogleButton = useCallback(
    (container: HTMLDivElement) => {
      setAuthError(null);
      ensureGoogleInit()
        .then(() => {
          if (!window.google?.accounts?.id) return;
          container.innerHTML = '';
          window.google.accounts.id.renderButton(container, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: 260,
          });
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : 'No se pudo cargar Google Login.';
          setAuthError(msg);
        });
    },
    [ensureGoogleInit]
  );

  const logout = useCallback(() => {
    clearCustomerToken();
    setCustomer(null);
    setAuthError(null);
  }, []);

  const value = useMemo(
    () => ({
      customer,
      loading,
      authError,
      mountGoogleButton,
      logout,
    }),
    [authError, customer, loading, logout, mountGoogleButton]
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth debe usarse dentro de CustomerAuthProvider.');
  return ctx;
}
