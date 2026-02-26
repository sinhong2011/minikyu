/**
 * Podcast Backend Command E2E Tests
 *
 * Tests the Rust backend podcast commands via Tauri IPC (invoke).
 *
 * Uses a fire-and-poll pattern where multi-step operations are chained
 * inside a single browser.execute to avoid WebDriver round-trips between
 * Tauri invoke calls.
 *
 * IMPORTANT: Raw invoke() bypasses the TypeScript bindings. i64 params must
 * be passed as numbers, not strings. i32 params must be integers, not floats.
 */

let invokeCounter = 0;

/** Fire a Tauri invoke and poll for the result via a window variable. */
async function tauriInvoke(command, args = {}) {
  const key = `__tauriResult_${++invokeCounter}`;

  await browser.execute(
    (cmd, cmdArgs, resultKey) => {
      window[resultKey] = { pending: true };
      window.__TAURI_INTERNALS__
        .invoke(cmd, cmdArgs)
        .then((data) => {
          window[resultKey] = { ok: true, data };
        })
        .catch((e) => {
          window[resultKey] = { ok: false, error: String(e) };
        });
    },
    command,
    args,
    key,
  );

  await browser.waitUntil(
    async () => {
      const r = await browser.execute((k) => window[k], key);
      return r && !r.pending;
    },
    { timeout: 15000, interval: 200, timeoutMsg: `tauriInvoke timeout: ${command}` },
  );

  return browser.execute((k) => {
    const r = window[k];
    delete window[k];
    return r;
  }, key);
}

/**
 * Fire a chain of Tauri invoke calls inside a single browser context and poll.
 * The chain is started by browser.execute and writes the final result to a
 * window variable that we poll from WebDriver.
 */
async function startChainAndPoll(key) {
  await browser.waitUntil(
    async () => {
      const r = await browser.execute((k) => window[k], key);
      return r && !r.pending;
    },
    { timeout: 15000, interval: 200, timeoutMsg: `tauriChain timeout (key=${key})` },
  );

  return browser.execute((k) => {
    const r = window[k];
    delete window[k];
    return r;
  }, key);
}

/** Helper: wait for database to be ready */
async function waitForDatabase() {
  await browser.waitUntil(
    async () => {
      try {
        const result = await tauriInvoke('get_podcast_progress_batch', { entryIds: [] });
        return result.ok === true;
      } catch {
        return false;
      }
    },
    { timeout: 15000, interval: 500, timeoutMsg: 'Database not ready after 15s' },
  );
}

describe('Podcast Backend Commands', () => {
  before(async () => {
    await waitForDatabase();

    // Seed test entries to satisfy FK constraints
    const seed = await tauriInvoke('seed_e2e_test_data', {
      entryIds: [12345, 11111, 22222, 33333],
    });
    if (!seed.ok) {
      throw new Error(`Failed to seed test data: ${seed.error}`);
    }
  });

  describe('get_podcast_progress_batch', () => {
    it('should return result for empty input', async () => {
      const result = await tauriInvoke('get_podcast_progress_batch', { entryIds: [] });
      expect(result.ok).toBe(true);
    });

    it('should return result for nonexistent numeric entry IDs', async () => {
      const result = await tauriInvoke('get_podcast_progress_batch', {
        entryIds: [99999, 88888],
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('get_podcast_progress', () => {
    it('should return null for nonexistent entry', async () => {
      const result = await tauriInvoke('get_podcast_progress', { entryId: 99999 });
      expect(result.ok).toBe(true);
      expect(result.data).toBe(null);
    });
  });

  describe('save_podcast_progress + get_podcast_progress', () => {
    it('should save and retrieve progress', async () => {
      const key = `__tauriResult_${++invokeCounter}`;
      await browser.execute((resultKey) => {
        window[resultKey] = { pending: true };
        const invoke = window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
        invoke('save_podcast_progress', { entryId: 12345, currentTime: 120, totalTime: 3600 })
          .then(() => invoke('get_podcast_progress', { entryId: 12345 }))
          .then((data) => { window[resultKey] = { ok: true, data }; })
          .catch((e) => { window[resultKey] = { ok: false, error: String(e) }; });
      }, key);

      const result = await startChainAndPoll(key);
      expect(result.ok).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data.completed).toBe(false);
    });

    it('should update existing progress (upsert)', async () => {
      const key = `__tauriResult_${++invokeCounter}`;
      await browser.execute((resultKey) => {
        window[resultKey] = { pending: true };
        const invoke = window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
        invoke('save_podcast_progress', { entryId: 12345, currentTime: 500, totalTime: 3600 })
          .then(() => invoke('get_podcast_progress', { entryId: 12345 }))
          .then((data) => { window[resultKey] = { ok: true, data }; })
          .catch((e) => { window[resultKey] = { ok: false, error: String(e) }; });
      }, key);

      const result = await startChainAndPoll(key);
      expect(result.ok).toBe(true);
      expect(result.data).toBeTruthy();
    });
  });

  describe('get_podcast_progress_batch (with data)', () => {
    it('should return batch results for saved entries', async () => {
      const key = `__tauriResult_${++invokeCounter}`;
      await browser.execute((resultKey) => {
        window[resultKey] = { pending: true };
        const invoke = window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
        invoke('save_podcast_progress', { entryId: 11111, currentTime: 60, totalTime: 1800 })
          .then(() => invoke('save_podcast_progress', { entryId: 22222, currentTime: 300, totalTime: 2400 }))
          .then(() => invoke('get_podcast_progress_batch', { entryIds: [11111, 22222, 99999] }))
          .then((data) => { window[resultKey] = { ok: true, data }; })
          .catch((e) => { window[resultKey] = { ok: false, error: String(e) }; });
      }, key);

      const result = await startChainAndPoll(key);
      expect(result.ok).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('mark_episode_completed', () => {
    it('should mark an episode as completed', async () => {
      const key = `__tauriResult_${++invokeCounter}`;
      await browser.execute((resultKey) => {
        window[resultKey] = { pending: true };
        const invoke = window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
        invoke('save_podcast_progress', { entryId: 33333, currentTime: 1700, totalTime: 1800 })
          .then(() => invoke('mark_episode_completed', { entryId: 33333 }))
          .then(() => invoke('get_podcast_progress', { entryId: 33333 }))
          .then((data) => { window[resultKey] = { ok: true, data }; })
          .catch((e) => { window[resultKey] = { ok: false, error: String(e) }; });
      }, key);

      const result = await startChainAndPoll(key);
      expect(result.ok).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data.completed).toBe(true);
    });
  });

  describe('get_podcast_feed_settings', () => {
    it('should return default settings for unknown feed', async () => {
      const result = await tauriInvoke('get_podcast_feed_settings', { feedId: 99999 });
      expect(result.ok).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data.playback_speed).toBe(1.0);
      expect(result.data.auto_download_count).toBe(3);
      expect(result.data.auto_cleanup_days).toBe(7);
    });
  });

  describe('update_podcast_feed_settings', () => {
    it('should save and retrieve feed settings', async () => {
      const key = `__tauriResult_${++invokeCounter}`;
      await browser.execute((resultKey) => {
        window[resultKey] = { pending: true };
        const invoke = window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
        invoke('update_podcast_feed_settings', { feedId: 55555, autoDownloadCount: 5, playbackSpeed: 1.5, autoCleanupDays: 14 })
          .then(() => invoke('get_podcast_feed_settings', { feedId: 55555 }))
          .then((data) => { window[resultKey] = { ok: true, data }; })
          .catch((e) => { window[resultKey] = { ok: false, error: String(e) }; });
      }, key);

      const result = await startChainAndPoll(key);
      expect(result.ok).toBe(true);
      expect(result.data.playback_speed).toBe(1.5);
      expect(result.data.auto_download_count).toBe(5);
      expect(result.data.auto_cleanup_days).toBe(14);
    });

    it('should update existing settings (upsert)', async () => {
      const key = `__tauriResult_${++invokeCounter}`;
      await browser.execute((resultKey) => {
        window[resultKey] = { pending: true };
        const invoke = window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
        invoke('update_podcast_feed_settings', { feedId: 55555, autoDownloadCount: 5, playbackSpeed: 2.0, autoCleanupDays: 14 })
          .then(() => invoke('get_podcast_feed_settings', { feedId: 55555 }))
          .then((data) => { window[resultKey] = { ok: true, data }; })
          .catch((e) => { window[resultKey] = { ok: false, error: String(e) }; });
      }, key);

      const result = await startChainAndPoll(key);
      expect(result.ok).toBe(true);
      expect(result.data.playback_speed).toBe(2.0);
    });
  });

  describe('cleanup_played_episodes', () => {
    it('should run cleanup without errors', async () => {
      const result = await tauriInvoke('cleanup_played_episodes', {});
      expect(result.ok).toBe(true);
      expect(result.data).toBeTruthy();
      expect(typeof result.data.deleted_count).toBe('number');
    });
  });
});
