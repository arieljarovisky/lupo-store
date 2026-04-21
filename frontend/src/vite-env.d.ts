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
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?:
                | 'signin_with'
                | 'signup_with'
                | 'continue_with'
                | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

export {};
