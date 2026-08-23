/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOG_LEVEL?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  /** Miniflux origin the PWA build talks to. Unused by the Tauri build. */
  readonly VITE_MINIFLUX_API_BASE?: string;
  /**
   * Miniflux host as the connect dialog prompts for it (no scheme). Doubles as
   * the proxy target when `VITE_MINIFLUX_API_BASE` is unset, which is why the
   * web client treats it as an origin that needs no CORS headers.
   */
  readonly VITE_SERVER_URL?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;

/** Build target: the Tauri desktop shell, or the browser PWA. */
declare const __APP_TARGET__: 'tauri' | 'web';
