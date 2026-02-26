/**
 * Podcast Player Store E2E Tests
 *
 * Tests the Zustand player store (player-store.ts) via the test bridge.
 * Verifies state management for: play, pause, resume, seek, speed,
 * volume, mute, stop-after-current, dismiss, and minimization.
 */

const MOCK_ENTRY = {
  id: '999',
  user_id: '1',
  feed_id: '1',
  status: 'read',
  hash: 'test-hash',
  title: 'Test Podcast Episode',
  url: 'https://example.com/episode',
  comments_url: '',
  published_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  changed_at: '2026-01-01T00:00:00Z',
  content: '<p>Test content</p>',
  author: 'Test Author',
  share_code: '',
  starred: false,
  reading_time: 0,
  enclosures: [],
  tags: null,
  feed: {
    id: '1',
    user_id: '1',
    feed_url: 'https://example.com/feed.xml',
    site_url: 'https://example.com',
    title: 'Test Podcast Feed',
    checked_at: '2026-01-01T00:00:00Z',
    next_check_at: '2026-01-01T00:00:00Z',
    etag_header: '',
    last_modified_header: '',
    parsing_error_message: '',
    parsing_error_count: 0,
    scraper_rules: '',
    rewrite_rules: '',
    crawler: false,
    blocklist_rules: '',
    keeplist_rules: '',
    urlrewrite_rules: '',
    user_agent: '',
    cookie: '',
    username: '',
    password: '',
    disabled: false,
    no_media_player: false,
    ignore_http_cache: false,
    allow_self_signed_certificates: false,
    fetch_via_proxy: false,
    hide_globally: false,
    apprise_service_urls: '',
    disable_http2: false,
    description: '',
    category: { id: '1', title: 'Podcasts', user_id: '1', hide_globally: false },
    icon: null,
  },
};

const MOCK_ENCLOSURE = {
  id: '100',
  user_id: '1',
  entry_id: '999',
  url: 'https://example.com/episode.mp3',
  mime_type: 'audio/mpeg',
  size: '50000000',
  length: '3600',
};

async function waitForTestBridge() {
  await browser.waitUntil(
    async () => browser.execute(() => window.__TEST__ != null),
    { timeout: 5000 },
  );
}

/** Read a single scalar field from the player store */
async function getField(field) {
  return browser.execute((f) => {
    const state = window.__TEST__.playerStore.getState();
    return state[f];
  }, field);
}

/** Read multiple scalar fields from the player store */
async function getFields(...fields) {
  return browser.execute((fs) => {
    const state = window.__TEST__.playerStore.getState();
    const result = {};
    for (const f of fs) {
      result[f] = state[f];
    }
    return result;
  }, fields);
}

async function resetPlayerStore() {
  await browser.execute(() => {
    const store = window.__TEST__.playerStore.getState();
    store.dismiss();
    // dismiss() doesn't reset speed/volume/mute — reset them manually
    store.setSpeed(1.0);
    store.setVolume(1.0);
    if (store.isMuted) store.toggleMute();
    if (store.stopAfterCurrent) store.toggleStopAfterCurrent();
  });
}

describe('Podcast Player Store', () => {
  before(async () => {
    await waitForTestBridge();
  });

  afterEach(async () => {
    await resetPlayerStore();
  });

  describe('Initial State', () => {
    it('should have no current entry', async () => {
      const hasEntry = await browser.execute(() =>
        window.__TEST__.playerStore.getState().currentEntry !== null,
      );
      expect(hasEntry).toBe(false);
    });

    it('should not be playing', async () => {
      expect(await getField('isPlaying')).toBe(false);
    });

    it('should have default playback speed 1.0', async () => {
      expect(await getField('playbackSpeed')).toBe(1.0);
    });

    it('should have default volume 1.0', async () => {
      expect(await getField('volume')).toBe(1.0);
    });

    it('should not be muted', async () => {
      expect(await getField('isMuted')).toBe(false);
    });

    it('should not stop after current', async () => {
      expect(await getField('stopAfterCurrent')).toBe(false);
    });

    it('should not be minimized', async () => {
      expect(await getField('isMinimized')).toBe(false);
    });

    it('should have zero progress', async () => {
      const state = await getFields('currentTime', 'duration', 'buffered');
      expect(state.currentTime).toBe(0);
      expect(state.duration).toBe(0);
      expect(state.buffered).toBe(0);
    });
  });

  describe('Play', () => {
    it('should set playing state', async () => {
      await browser.execute((entry, enc) => {
        window.__TEST__.playerStore.getState().play(entry, enc);
      }, MOCK_ENTRY, MOCK_ENCLOSURE);

      expect(await getField('isPlaying')).toBe(true);
    });

    it('should set current entry', async () => {
      await browser.execute((entry, enc) => {
        window.__TEST__.playerStore.getState().play(entry, enc);
      }, MOCK_ENTRY, MOCK_ENCLOSURE);

      const entryId = await browser.execute(() =>
        window.__TEST__.playerStore.getState().currentEntry?.id,
      );
      expect(entryId).toBe('999');
    });

    it('should reset progress on new play', async () => {
      await browser.execute((entry, enc) => {
        const store = window.__TEST__.playerStore.getState();
        store.play(entry, enc);
        store._updateTime(500);
        store._updateDuration(1000);
        // Play again should reset
        store.play(entry, enc);
      }, MOCK_ENTRY, MOCK_ENCLOSURE);

      const state = await getFields('currentTime', 'duration');
      expect(state.currentTime).toBe(0);
      expect(state.duration).toBe(0);
    });

    it('should un-minimize on new play', async () => {
      await browser.execute((entry, enc) => {
        const store = window.__TEST__.playerStore.getState();
        store.play(entry, enc);
        store.setMinimized(true);
        store.play(entry, enc);
      }, MOCK_ENTRY, MOCK_ENCLOSURE);

      expect(await getField('isMinimized')).toBe(false);
    });
  });

  describe('Pause / Resume', () => {
    it('should pause playback', async () => {
      await browser.execute((entry, enc) => {
        const store = window.__TEST__.playerStore.getState();
        store.play(entry, enc);
        store.pause();
      }, MOCK_ENTRY, MOCK_ENCLOSURE);

      expect(await getField('isPlaying')).toBe(false);
    });

    it('should resume playback', async () => {
      await browser.execute((entry, enc) => {
        const store = window.__TEST__.playerStore.getState();
        store.play(entry, enc);
        store.pause();
        store.resume();
      }, MOCK_ENTRY, MOCK_ENCLOSURE);

      expect(await getField('isPlaying')).toBe(true);
    });

    it('should keep entry on pause', async () => {
      await browser.execute((entry, enc) => {
        const store = window.__TEST__.playerStore.getState();
        store.play(entry, enc);
        store.pause();
      }, MOCK_ENTRY, MOCK_ENCLOSURE);

      const hasEntry = await browser.execute(() =>
        window.__TEST__.playerStore.getState().currentEntry !== null,
      );
      expect(hasEntry).toBe(true);
    });
  });

  describe('Seek', () => {
    it('should update currentTime', async () => {
      await browser.execute((entry, enc) => {
        const store = window.__TEST__.playerStore.getState();
        store.play(entry, enc);
        store._updateDuration(3600);
        store.seek(120);
      }, MOCK_ENTRY, MOCK_ENCLOSURE);

      expect(await getField('currentTime')).toBe(120);
    });
  });

  describe('Speed Control', () => {
    it('should change playback speed', async () => {
      await browser.execute(() => {
        window.__TEST__.playerStore.getState().setSpeed(1.5);
      });
      expect(await getField('playbackSpeed')).toBe(1.5);
    });

    it('should handle all speed presets', async () => {
      const presets = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
      for (const speed of presets) {
        await browser.execute((s) => {
          window.__TEST__.playerStore.getState().setSpeed(s);
        }, speed);
        expect(await getField('playbackSpeed')).toBe(speed);
      }
    });

    it('should handle speed range edges', async () => {
      await browser.execute(() => {
        window.__TEST__.playerStore.getState().setSpeed(0.5);
      });
      expect(await getField('playbackSpeed')).toBe(0.5);

      await browser.execute(() => {
        window.__TEST__.playerStore.getState().setSpeed(3.0);
      });
      expect(await getField('playbackSpeed')).toBe(3.0);
    });
  });

  describe('Volume Control', () => {
    it('should change volume', async () => {
      await browser.execute(() => {
        window.__TEST__.playerStore.getState().setVolume(0.5);
      });
      expect(await getField('volume')).toBe(0.5);
    });

    it('should set volume to zero', async () => {
      await browser.execute(() => {
        window.__TEST__.playerStore.getState().setVolume(0);
      });
      expect(await getField('volume')).toBe(0);
    });

    it('should toggle mute on and off', async () => {
      await browser.execute(() => {
        window.__TEST__.playerStore.getState().toggleMute();
      });
      expect(await getField('isMuted')).toBe(true);

      await browser.execute(() => {
        window.__TEST__.playerStore.getState().toggleMute();
      });
      expect(await getField('isMuted')).toBe(false);
    });
  });

  describe('Stop After Current', () => {
    it('should toggle stop after current on and off', async () => {
      await browser.execute(() => {
        window.__TEST__.playerStore.getState().toggleStopAfterCurrent();
      });
      expect(await getField('stopAfterCurrent')).toBe(true);

      await browser.execute(() => {
        window.__TEST__.playerStore.getState().toggleStopAfterCurrent();
      });
      expect(await getField('stopAfterCurrent')).toBe(false);
    });
  });

  describe('Internal Actions', () => {
    it('should update time via _updateTime', async () => {
      await browser.execute(() => {
        window.__TEST__.playerStore.getState()._updateTime(42.5);
      });
      expect(await getField('currentTime')).toBe(42.5);
    });

    it('should update duration via _updateDuration', async () => {
      await browser.execute(() => {
        window.__TEST__.playerStore.getState()._updateDuration(7200);
      });
      expect(await getField('duration')).toBe(7200);
    });

    it('should update buffered via _updateBuffered', async () => {
      await browser.execute(() => {
        window.__TEST__.playerStore.getState()._updateBuffered(1800);
      });
      expect(await getField('buffered')).toBe(1800);
    });

    it('should set playing via _setPlaying', async () => {
      await browser.execute(() => {
        window.__TEST__.playerStore.getState()._setPlaying(true);
      });
      expect(await getField('isPlaying')).toBe(true);

      await browser.execute(() => {
        window.__TEST__.playerStore.getState()._setPlaying(false);
      });
      expect(await getField('isPlaying')).toBe(false);
    });
  });

  describe('Dismiss', () => {
    it('should clear all state', async () => {
      await browser.execute((entry, enc) => {
        const store = window.__TEST__.playerStore.getState();
        store.play(entry, enc);
        store._updateDuration(3600);
        store.seek(500);
        store.setSpeed(1.5);
        store.setMinimized(true);
        store.dismiss();
      }, MOCK_ENTRY, MOCK_ENCLOSURE);

      const hasEntry = await browser.execute(() =>
        window.__TEST__.playerStore.getState().currentEntry !== null,
      );
      expect(hasEntry).toBe(false);

      const state = await getFields('isPlaying', 'currentTime', 'duration', 'isMinimized');
      expect(state.isPlaying).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.duration).toBe(0);
      expect(state.isMinimized).toBe(false);
    });
  });

  describe('Minimization', () => {
    it('should set minimized state', async () => {
      // Play first, let React effects settle, then minimize
      await browser.execute((entry, enc) => {
        window.__TEST__.playerStore.getState().play(entry, enc);
      }, MOCK_ENTRY, MOCK_ENCLOSURE);

      // Wait for React effects (EntryReading auto-minimization) to settle
      await browser.pause(200);

      await browser.execute(() => {
        window.__TEST__.playerStore.getState().setMinimized(true);
      });

      // Verify state after effects
      await browser.waitUntil(
        async () => (await getField('isMinimized')) === true,
        { timeout: 2000, interval: 100, timeoutMsg: 'isMinimized never became true' },
      );
    });

    it('should un-minimize', async () => {
      await browser.execute((entry, enc) => {
        window.__TEST__.playerStore.getState().play(entry, enc);
      }, MOCK_ENTRY, MOCK_ENCLOSURE);

      await browser.pause(200);

      await browser.execute(() => {
        const store = window.__TEST__.playerStore.getState();
        store.setMinimized(true);
      });
      await browser.pause(100);

      await browser.execute(() => {
        window.__TEST__.playerStore.getState().setMinimized(false);
      });

      await browser.waitUntil(
        async () => (await getField('isMinimized')) === false,
        { timeout: 2000, interval: 100, timeoutMsg: 'isMinimized never became false' },
      );
    });
  });
});
