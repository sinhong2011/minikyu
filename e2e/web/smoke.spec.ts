/**
 * Smoke tests for the PWA (`web`) target.
 *
 * These run against `bun run dev:web` with **no Miniflux behind it**, which is
 * deliberate: the unauthenticated welcome screen is the first thing a new user
 * sees, and it is where the web build has historically broken.
 *
 * The load-time assertions below are the point of this file. Commands the web
 * adapter does not implement throw `UnsupportedInWebError`, and a missing
 * capability gate surfaces as exactly that — usually as an unhandled rejection
 * that no test would otherwise notice. `gate-coverage.test.ts` catches those
 * statically; this catches whatever slips past it at runtime.
 */

import { expect, type Page, test } from '@playwright/test';

/** Collects page errors, console errors and unhandled rejections. */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  return errors;
}

/** Errors that are noise in a backend-less dev run, not build defects. */
function isExpectedOffline(message: string): boolean {
  return (
    /Failed to load resource/i.test(message) ||
    /net::ERR_/i.test(message) ||
    /\/miniflux-api\//.test(message) ||
    /Failed to fetch/i.test(message)
  );
}

test.describe('web build boots', () => {
  test('loads without unsupported-command errors', async ({ page }) => {
    const errors = watchForErrors(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const unsupported = errors.filter((e) => /UnsupportedInWeb/i.test(e));
    expect(
      unsupported,
      'A command reached the web adapter stub. That means a missing capability ' +
        'gate — see src/lib/platform.ts and gate-coverage.test.ts.'
    ).toEqual([]);

    const unexpected = errors.filter((e) => !isExpectedOffline(e));
    expect(unexpected, 'Unexpected console/page errors on first load').toEqual([]);
  });

  test('renders the welcome screen when no account is connected', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Welcome to Miniflux/i)).toBeVisible({ timeout: 15_000 });
  });

  test('does not offer desktop-only settings panes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Preferences are reachable without an account; the panes below are backed
    // by the Rust side and must not appear in a browser.
    await page.keyboard.press('ControlOrMeta+,');

    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible().catch(() => false)) {
      for (const pane of [/^Translation$/, /^Gestures?$/, /^Sync$/]) {
        await expect(dialog.getByRole('button', { name: pane })).toHaveCount(0);
      }
    }
  });
});
