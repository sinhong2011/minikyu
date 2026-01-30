/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOG_LEVEL?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  readonly DEV: boolean;
  readonly PROD: boolean;
}

// biome-ignore lint/correctness/noUnusedVariables: Required for TypeScript type augmentation
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
