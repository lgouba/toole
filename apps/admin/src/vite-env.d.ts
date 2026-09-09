/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injecté par Vite (define) depuis package.json — cf. vite.config.ts.
declare const __APP_VERSION__: string;
