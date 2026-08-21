/**
 * Guards the web build against ungated Tauri commands.
 *
 * The web adapter implements a subset of the generated bindings; everything
 * else resolves to a stub that throws `UnsupportedInWebError` (see
 * `commands.ts`). That error is only ever a *missing capability gate* — so a
 * call site reaching it is a bug, and one that only shows up at runtime, in the
 * browser, on whichever screen happens to touch it.
 *
 * Manual gating has proven not to hold: several panes shipped calling
 * unimplemented commands with no gate at all. This test freezes the current
 * call-site surface instead. Adding an ungated call to an unimplemented command
 * fails here rather than in front of a user.
 *
 * **When this test fails**, the fix is almost always to gate the UI:
 *
 * ```tsx
 * import { capabilities } from '@/lib/platform';
 * {capabilities.cloudSync && <CloudSyncSection />}
 * ```
 *
 * Only add a file to `GATED_BY_ANCESTOR` when the call genuinely cannot run in
 * the browser — a window that is never opened, a service only started behind a
 * capability — and say which gate makes it unreachable.
 */

import { describe, expect, it } from 'vite-plus/test';

/**
 * Every source file, read as text. `import.meta.glob` keeps this a plain Vite
 * transform — no node:fs, so the file typechecks under the app tsconfig, which
 * deliberately loads no ambient node types.
 */
const SOURCES = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Repo-relative path (`src/...`) for a glob key (`/src/...`). */
function rel(key: string): string {
  return key.replace(/^\//, '');
}

function read(relPath: string): string {
  const source = SOURCES[`/${relPath}`];
  if (source === undefined) throw new Error(`Not found in glob: ${relPath}`);
  return source;
}

/**
 * Files that call an unimplemented command but cannot reach it in the browser,
 * each with the reason. These are audited by hand — keep the reason accurate.
 */
const GATED_BY_ANCESTOR: Record<string, string> = {
  'src/components/downloads/DownloadManagerDialog.tsx':
    'rendered only under capabilities.downloads (MainWindow, WindowTitleBar)',
  'src/components/preferences/panes/CloudSyncSection.tsx':
    'rendered only under capabilities.cloudSync (AdvancedPane)',
  'src/components/titlebar/TitleBarPodcastAnchor.tsx':
    'rendered only under capabilities.podcastWindow (WindowTitleBar)',
  'src/components/miniflux/ImmersiveTranslationLayer.tsx':
    'mounted only when capabilities.translation is on',
  'src/components/miniflux/InAppBrowserPane.tsx': 'reached only via capabilities.inAppBrowser',
  'src/components/podcast/PodcastPlayer.tsx': 'download action lives behind capabilities.downloads',
  'src/components/preferences/panes/TranslationPane.tsx':
    "pane hidden in PreferencesDialog's hiddenPanes when !capabilities.translation",
  'src/components/quick-pane/QuickPaneApp.tsx':
    'quick-pane window only exists under capabilities.auxiliaryWindows',
  'src/components/miniflux/ImageViewer.tsx': 'download action behind capabilities.downloads',
  'src/hooks/use-audio-engine.ts': 'podcast window calls behind capabilities.podcastWindow',
  'src/lib/commands/podcast-commands.ts': 'commands registered behind capabilities.podcastWindow',
  'src/lib/menu.ts': 'native menu is only built when capabilities.nativeMenu',
  'src/lib/shiki-highlight.ts': 'wrapped in try/catch with a local-detection fallback',
  'src/pages/PlayerWindow.tsx': 'separate window, never mounted in the web build',
  'src/pages/TrayPopover.tsx': 'separate window, never mounted in the web build',
  'src/services/miniflux/podcast.ts': 'progress calls behind capabilities.podcastWindow',
  'src/services/tray.ts': 'tray service only starts under capabilities.tray',
  'src/services/translation/router.ts': 'router only invoked when capabilities.translation',
};

function commandNames(source: string, indent: string): Set<string> {
  return new Set(
    [...source.matchAll(new RegExp(`^${indent}async (\\w+)\\(`, 'gm'))].map((m) => m[1] as string)
  );
}

describe('web build capability gating', () => {
  const generated = commandNames(read('src/lib/bindings.ts'), '');
  const implemented = commandNames(read('src/lib/web/commands.ts'), '  ');
  const unsupported = [...generated].filter((c) => !implemented.has(c));

  it('has commands the web adapter does not implement', () => {
    // Sanity check on the parsing above — if either regex silently stops
    // matching, every assertion below would pass vacuously.
    expect(generated.size).toBeGreaterThan(100);
    expect(implemented.size).toBeGreaterThan(40);
    expect(unsupported.length).toBeGreaterThan(0);
  });

  it('never calls an unsupported command from an ungated module', () => {
    const offenders: string[] = [];

    for (const [key, source] of Object.entries(SOURCES)) {
      const path = rel(key);
      if (/\.test\.tsx?$/.test(path)) continue;
      if (path.startsWith('src/lib/web/')) continue;

      const called = unsupported.filter((c) => source.includes(`commands.${c}(`));
      if (called.length === 0) continue;

      // A module is considered gated when it consults the capability map (or
      // the raw target flag) somewhere — the coarse check that matches how
      // these components are actually written.
      if (source.includes('capabilities.') || source.includes('isTauri')) continue;
      if (path in GATED_BY_ANCESTOR) continue;

      offenders.push(`${path} → ${called.sort().join(', ')}`);
    }

    expect(
      offenders,
      'These modules call a command the web adapter does not implement, with no ' +
        'capability gate. In the browser the call throws UnsupportedInWebError. ' +
        'Gate the UI on `capabilities.*` from @/lib/platform, or — if an ancestor ' +
        'already makes it unreachable — add the file to GATED_BY_ANCESTOR with the reason.'
    ).toEqual([]);
  });

  it('keeps GATED_BY_ANCESTOR free of stale entries', () => {
    const stale = Object.keys(GATED_BY_ANCESTOR).filter((relPath) => {
      const source = read(relPath);
      return !unsupported.some((c) => source.includes(`commands.${c}(`));
    });

    expect(
      stale,
      'These files no longer call any unsupported command, so their exemption ' +
        'is dead weight — remove them from GATED_BY_ANCESTOR.'
    ).toEqual([]);
  });
});
