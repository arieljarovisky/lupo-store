/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base del API (sin /api). Vacío = mismo origen. */
  readonly VITE_API_URL?: string;
  /** Envío al backend en header x-import-key al importar desde Tienda Nube. */
  readonly VITE_IMPORT_API_KEY?: string;
  /** OAuth Google: mismo Client ID que en el backend. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    /** Opcional: URL del API sin rebuild (misma función que VITE_API_URL). */
    __LUPO_API_BASE__?: string;
  }
}

export {};
