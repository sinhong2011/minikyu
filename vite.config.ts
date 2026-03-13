import { resolve } from 'node:path';
import { lingui } from '@lingui/vite-plugin';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import packageJson from './package.json';

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  define: {
    // biome-ignore lint/style/useNamingConvention: Global constant
    __APP_VERSION__: JSON.stringify(packageJson.version),
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
  ],
  resolve: {
    tsconfigPaths: true, // Native in Vite 8, replaces vite-tsconfig-paths
  },
  css: {
    transformer: 'lightningcss',
  },
  build: {
    chunkSizeWarningLimit: 600, // Prevent warnings for template's bundled components
    rolldownOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'quick-pane': resolve(__dirname, 'quick-pane.html'),
        'player-window': resolve(__dirname, 'player-window.html'),
        'tray-popover': resolve(__dirname, 'tray-popover.html'),
      },
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
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    // Disable Vite's raw error overlay — the app has a custom React ErrorBoundary
    overlay: false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
}));
