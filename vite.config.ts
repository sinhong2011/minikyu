import { resolve } from 'node:path';
import { lingui } from '@lingui/vite-plugin';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite-plus';
import { serwist } from 'vite-plugin-serwist';
import type { Plugin } from 'vite-plus';
import packageJson from './package.json';

const host = process.env.TAURI_DEV_HOST;
const rootDir = import.meta.dirname;

/**
 * Miniflux origin the PWA's local servers proxy to. Browsers enforce CORS and
 * Miniflux sends no CORS headers, so the web build always talks to a
 * same-origin `/miniflux-api` prefix. Locally that prefix is proxied here; in
 * production it must be provided by a reverse proxy (docs/developer/pwa.md).
 *
 * Resolution order: an explicit `VITE_MINIFLUX_API_BASE`, then the
 * `VITE_SERVER_URL` already in `.env` (the same value the connect dialog's
 * "Fill from .env" button uses), then a local Miniflux.
 */
function resolveMinifluxApiBase(mode: string): string {
  const env = loadEnv(mode, rootDir, '');
  const raw = (env.VITE_MINIFLUX_API_BASE || env.VITE_SERVER_URL || 'http://localhost:8080').trim();
  // `VITE_SERVER_URL` is entered the way the connect dialog prompts for it
  // ("miniflux.example.com"), i.e. usually without a scheme — but a proxy
  // target must be an absolute URL. Assume https for anything but localhost.
  const withScheme = /^https?:\/\//i.test(raw)
    ? raw
    : `${/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(raw) ? 'http' : 'https'}://${raw}`;
  return withScheme.replace(/\/+$/, '');
}

/** Shared proxy config: `vite preview` does not inherit `server.proxy`. */
function minifluxProxy(target: string) {
  return {
    '/miniflux-api': {
      target,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/miniflux-api/, ''),
    },
  };
}

/**
 * PWA-only <head> additions; the Tauri build needs none of them.
 *
 * The two `theme-color` values are the app's `--background` token resolved for
 * each scheme, and they only cover first paint: `src/lib/theme-color.ts` takes
 * over once React mounts and follows the user's actual theme choice. Keep them
 * in step with `src/styles/theme.css` so the title bar does not flash a colour
 * the window never shows.
 */
const PWA_HEAD_TAGS = `
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#161616" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="#f7f4f4" media="(prefers-color-scheme: light)" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Minikyu" />
    <meta name="description" content="A Miniflux reader for the web." />`;

/**
 * Adapts the shared `index.html` for the PWA build rather than maintaining a
 * second copy: adds the manifest/theme tags and drops the standalone React
 * DevTools bridge, which is a desktop-dev convenience and would 404 once
 * deployed. Sharing one entry keeps dev (`/`) and build output aligned.
 */
function webHtmlPlugin(): Plugin {
  return {
    name: 'minikyu:web-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html: string) {
        return html
          .replace(/\s*<script src="http:\/\/localhost:8097"><\/script>/, '')
          .replace('</head>', `${PWA_HEAD_TAGS}\n  </head>`);
      },
    },
  };
}

// Generated/vendored paths that neither lint nor format should touch.
// `.claude/worktrees` and `.worktrees` hold nested checkouts of this same repo;
// formatting through them would rewrite files belonging to another branch.
const toolingIgnorePatterns = [
  'dist/**',
  // The Rust crate is owned by `cargo fmt`/`clippy`; oxfmt must not restyle
  // its Cargo.toml or config files.
  'src-tauri/**',
  'jscpd-report/**',
  '.claude/**',
  '.worktrees/**',
  '.agents/**',
  '.opencode/**',
  '.kilocode/**',
  '.sisyphus/**',
  'src/lib/bindings.ts',
  'src/routeTree.gen.ts',
  'src/locales/**/messages.ts',
];

// https://vite.dev/config/
// `mode === 'web'` builds the installable, online-only PWA; every other mode
// builds the Tauri desktop shell. See docs/developer/pwa.md.
export default defineConfig(({ mode }) => {
  const isWeb = mode === 'web';
  const minifluxApiBase = isWeb ? resolveMinifluxApiBase(mode) : '';

  // The PWA is a single page; the extra HTML entries are Tauri windows.
  const buildInput: Record<string, string> = isWeb
    ? { main: resolve(rootDir, 'index.html') }
    : {
        main: resolve(rootDir, 'index.html'),
        'quick-pane': resolve(rootDir, 'quick-pane.html'),
        'player-window': resolve(rootDir, 'player-window.html'),
        'tray-popover': resolve(rootDir, 'tray-popover.html'),
      };

  return {
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
      __APP_TARGET__: JSON.stringify(isWeb ? 'web' : 'tauri'),
    },
    plugins: [
      tanstackRouter(), // MUST be before react()
      react(), // v6: Oxc-based JSX transform and Fast Refresh
      babel({
        presets: [reactCompilerPreset()],
        plugins: ['@lingui/babel-plugin-lingui-macro'],
      }),
      lingui(),
      tailwindcss(),
      ...(isWeb
        ? [
            webHtmlPlugin(),
            serwist({
              swSrc: resolve(rootDir, 'src/sw.ts'),
              swDest: 'sw.js',
              swUrl: '/sw.js',
              globDirectory: 'dist',
              injectionPoint: 'self.__SW_MANIFEST',
              rollupFormat: 'es',
              type: 'module',
              scope: '/',
            }),
          ]
        : []),
    ],
    resolve: {
      tsconfigPaths: true, // Native in Vite 8, replaces vite-tsconfig-paths
      // The single seam that swaps the Rust backend for the REST-backed web
      // adapter. Every call site imports `@/lib/tauri-bindings`; only this alias
      // changes between targets.
      ...(isWeb
        ? { alias: { '@/lib/tauri-bindings': resolve(rootDir, 'src/lib/web/commands.ts') } }
        : {}),
    },
    css: {
      transformer: 'lightningcss',
    },
    build: {
      chunkSizeWarningLimit: 600, // Prevent warnings for template's bundled components
      rolldownOptions: {
        input: buildInput,
        output: {
          manualChunks(id) {
            if (id.includes('@base-ui/react')) return 'base-ui';
            if (id.includes('@tanstack')) return 'tanstack';
            if (id.includes('date-fns')) return 'date-fns';
            if (id.includes('@dnd-kit')) return 'dnd-kit';
          },
        },
      },
    },
    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // `vite preview` has its own server and does NOT inherit `server.proxy`,
    // so the built PWA needs the prefix wired up here as well.
    ...(isWeb ? { preview: { port: 4173, proxy: minifluxProxy(minifluxApiBase) } } : {}),
    server: isWeb
      ? {
          port: 5173,
          // Same-origin prefix the web adapter calls; proxied so the browser
          // never makes a cross-origin request Miniflux would reject.
          proxy: minifluxProxy(minifluxApiBase),
          hmr: { overlay: false },
        }
      : {
          // 2. tauri expects a fixed port, fail if that port is not available
          port: 1420,
          strictPort: true,
          host: host || false,
          // Disable Vite's raw error overlay — the app has a custom React ErrorBoundary.
          // This belongs under `hmr`; a bare `server.overlay` is not a Vite option and
          // was silently ignored.
          hmr: host
            ? {
                protocol: 'ws',
                host,
                port: 1421,
                overlay: false,
              }
            : { overlay: false },
          watch: {
            // 3. tell vite to ignore watching `src-tauri`
            ignored: ['**/src-tauri/**'],
          },
        },

    // Vitest config (merged from the former vitest.config.ts — Vite+ owns one config file)
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['{src,deploy}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      exclude: ['node_modules', 'dist', 'src-tauri', '.git', '.cache', 'build'],
      coverage: {
        provider: 'v8',
        thresholds: {
          lines: 60,
          functions: 60,
          branches: 60,
        },
      },
    },

    // oxlint — replaces Biome's linter
    lint: {
      ignorePatterns: toolingIgnorePatterns,
      options: {
        typeAware: true,
        typeCheck: true,
      },
    },

    // oxfmt — replaces Biome's formatter. Values mirror the previous biome.json
    // style so the one-time reformat stays as small as possible.
    fmt: {
      // Markdown stays unformatted, as it was under biome.json — CHANGELOG.md is
      // generated by release-please and would churn on every release.
      ignorePatterns: ['**/*.md', ...toolingIgnorePatterns],
      singleQuote: true,
      jsxSingleQuote: false,
      semi: true,
      trailingComma: 'es5',
      printWidth: 100,
      tabWidth: 2,
      endOfLine: 'lf',
    },
  };
});
