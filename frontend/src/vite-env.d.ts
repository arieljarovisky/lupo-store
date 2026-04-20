/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base del API (sin /api). Vacío = mismo origen. */
  readonly VITE_API_URL?: string;
  /** OAuth Google: mismo Client ID que en el backend. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Clave pública para Mercado Pago CardForm embebido. */
  readonly VITE_MERCADO_PAGO_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface MercadoPagoCardFormInstance {
    getCardFormData: () => {
      token: string;
      paymentMethodId: string;
      issuerId?: string;
      installments: string;
      cardholderEmail: string;
      identificationType?: string;
      identificationNumber?: string;
    };
    unmount: () => void;
    mount: () => void;
  }

  interface MercadoPagoInstance {
    cardForm: (params: unknown) => MercadoPagoCardFormInstance;
  }

  interface MercadoPagoConstructor {
    new (publicKey: string, options?: { locale?: string }): MercadoPagoInstance;
  }

  interface Window {
    /** Opcional: URL del API sin rebuild (misma función que VITE_API_URL). */
    __LUPO_API_BASE__?: string;
    MercadoPago?: MercadoPagoConstructor;
  }
}

export {};
