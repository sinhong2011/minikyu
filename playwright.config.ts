import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

/**
 * Two targets, two dev servers (see `docs/developer/pwa.md`):
 *
 * - `desktop` — the Tauri-target bundle on :1420, driven in a plain browser.
 * - `web` / `web-mobile` — the PWA bundle on :5173. `web-mobile` exercises the
 *   phone layout (bottom tab bar, drawer) that the desktop viewport never shows.
 *
 * The web specs run with no Miniflux behind them on purpose — the welcome
 * screen is where missing capability gates surface.
 */

const DESKTOP_URL = 'http://localhost:1420';
const WEB_URL = 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'desktop',
      testDir: './e2e',
      testIgnore: /web\//,
      use: { ...devices['Desktop Chrome'], baseURL: DESKTOP_URL },
    },
    {
      name: 'web',
      testDir: './e2e/web',
      use: { ...devices['Desktop Chrome'], baseURL: WEB_URL },
    },
    {
      name: 'web-mobile',
      testDir: './e2e/web',
      use: { ...devices['Pixel 7'], baseURL: WEB_URL },
    },
  ],

  webServer: [
    {
      command: 'bun run dev',
      url: DESKTOP_URL,
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
    {
      command: 'bun run dev:web',
      url: WEB_URL,
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
  ],
});
