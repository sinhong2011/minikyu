/**
 * Podcast Playback Diagnostic E2E Tests
 *
 * Diagnoses the full podcast audio playback chain using only Tauri IPC
 * (no test bridge dependency). Works with production builds.
 *
 * 1. Database: Are enclosures stored?
 * 2. API: Does getEntry return enclosures?
 * 3. Audio: Can the HTML Audio element load and play the URL?
 */

async function waitForTauriIpc() {
  await browser.waitUntil(
    async () =>
      browser.execute(
        () => typeof window.__TAURI_INTERNALS__ !== 'undefined',
      ),
    { timeout: 15000, timeoutMsg: 'Tauri IPC not available' },
  );
}

describe('Podcast Playback Diagnostic', () => {
  before(async () => {
    await waitForTauriIpc();
    // Give the app a moment to finish initialization and auto-reconnect
    await browser.pause(3000);
  });

  describe('Step 1: Database Enclosures', () => {
    it('should have entries with enclosures in the database', async () => {
      const result = await browser.executeAsync(async (done) => {
        try {
          const { invoke } = window.__TAURI_INTERNALS__;

          // Try unread entries first, then all entries
          for (const status of [null, 'unread', 'read']) {
            const filters = { limit: 100 };
            if (status) filters.status = status;

            const response = await invoke('get_entries', { filters });
            const entries = response?.entries || [];
            const withEnclosures = entries.filter(
              (e) => e.enclosures && e.enclosures.length > 0,
            );
            const audioEnclosures = entries.flatMap((e) =>
              (e.enclosures || []).filter((enc) =>
                enc.mime_type.startsWith('audio/'),
              ),
            );

            if (audioEnclosures.length > 0) {
              done({
                success: true,
                status: status || 'all',
                totalEntries: response.total,
                fetchedEntries: entries.length,
                entriesWithEnclosures: withEnclosures.length,
                audioEnclosureCount: audioEnclosures.length,
                sampleEnclosures: audioEnclosures.slice(0, 3).map((enc) => ({
                  id: enc.id,
                  url: enc.url?.substring(0, 100),
                  mime_type: enc.mime_type,
                  entry_id: enc.entry_id,
                })),
              });
              return;
            }
          }

          done({
            success: false,
            error:
              'No audio enclosures found in any entries. The database may need a re-sync.',
          });
        } catch (err) {
          done({ success: false, error: String(err) });
        }
      });

      console.log(
        '\n=== Database Enclosures ===\n' +
          JSON.stringify(result, null, 2),
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Step 2: Single Entry Fetch With Enclosures', () => {
    it('should return enclosures when fetching a single entry', async () => {
      const result = await browser.executeAsync(async (done) => {
        try {
          const { invoke } = window.__TAURI_INTERNALS__;

          // Find a podcast entry
          const response = await invoke('get_entries', {
            filters: { limit: 100 },
          });
          const entries = response?.entries || [];
          let podcastEntry = null;

          for (const entry of entries) {
            const audioEnc = (entry.enclosures || []).find((enc) =>
              enc.mime_type.startsWith('audio/'),
            );
            if (audioEnc) {
              podcastEntry = entry;
              break;
            }
          }

          if (!podcastEntry) {
            done({
              success: false,
              error: 'No podcast entry found in get_entries results',
            });
            return;
          }

          // Now fetch the single entry via get_entry
          const singleEntry = await invoke('get_entry', {
            entryId: podcastEntry.id,
          });

          const singleAudioEnc = (singleEntry.enclosures || []).find((enc) =>
            enc.mime_type.startsWith('audio/'),
          );

          done({
            success: !!singleAudioEnc,
            entryId: singleEntry.id,
            title: singleEntry.title,
            feedTitle: singleEntry.feed?.title,
            hasEnclosures: !!(
              singleEntry.enclosures && singleEntry.enclosures.length > 0
            ),
            enclosureCount: singleEntry.enclosures?.length ?? 0,
            audioUrl: singleAudioEnc?.url?.substring(0, 100),
            audioMimeType: singleAudioEnc?.mime_type,
          });
        } catch (err) {
          done({ success: false, error: String(err) });
        }
      });

      console.log(
        '\n=== Single Entry Enclosures ===\n' +
          JSON.stringify(result, null, 2),
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Step 3: Audio Element Load Test', () => {
    it('should load audio metadata from podcast URL', async () => {
      const result = await browser.executeAsync(async (done) => {
        try {
          const { invoke } = window.__TAURI_INTERNALS__;

          // Find a podcast audio URL
          const response = await invoke('get_entries', {
            filters: { limit: 100 },
          });
          let audioUrl = null;

          for (const entry of response?.entries || []) {
            const audioEnc = (entry.enclosures || []).find((enc) =>
              enc.mime_type.startsWith('audio/'),
            );
            if (audioEnc) {
              audioUrl = audioEnc.url;
              break;
            }
          }

          if (!audioUrl) {
            done({ success: false, error: 'No podcast audio URL available' });
            return;
          }

          // Test Audio element loading
          const audio = new Audio();
          let settled = false;

          const timeout = setTimeout(() => {
            if (!settled) {
              settled = true;
              done({
                success: false,
                error: 'Timeout (15s) waiting for audio metadata',
                networkState: audio.networkState,
                readyState: audio.readyState,
                errorCode: audio.error?.code,
                errorMessage: audio.error?.message,
                url: audioUrl.substring(0, 100),
              });
              audio.src = '';
            }
          }, 15000);

          audio.addEventListener('loadedmetadata', () => {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              done({
                success: true,
                event: 'loadedmetadata',
                duration: audio.duration,
                networkState: audio.networkState,
                readyState: audio.readyState,
                url: audioUrl.substring(0, 100),
              });
              audio.src = '';
            }
          });

          audio.addEventListener('canplay', () => {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              done({
                success: true,
                event: 'canplay',
                duration: audio.duration,
                networkState: audio.networkState,
                readyState: audio.readyState,
                url: audioUrl.substring(0, 100),
              });
              audio.src = '';
            }
          });

          audio.addEventListener('error', () => {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              done({
                success: false,
                error: `Audio element error: code=${audio.error?.code} message=${audio.error?.message}`,
                networkState: audio.networkState,
                readyState: audio.readyState,
                url: audioUrl.substring(0, 100),
              });
            }
          });

          // Do NOT set crossOrigin — this was a root cause of failures
          audio.src = audioUrl;
          audio.load();
        } catch (err) {
          done({ success: false, error: String(err) });
        }
      });

      console.log(
        '\n=== Audio Load Test ===\n' + JSON.stringify(result, null, 2),
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Step 4: Audio Playback Test', () => {
    it('should actually play audio and advance currentTime', async () => {
      const result = await browser.executeAsync(async (done) => {
        try {
          const { invoke } = window.__TAURI_INTERNALS__;

          // Find a podcast audio URL
          const response = await invoke('get_entries', {
            filters: { limit: 100 },
          });
          let audioUrl = null;

          for (const entry of response?.entries || []) {
            const audioEnc = (entry.enclosures || []).find((enc) =>
              enc.mime_type.startsWith('audio/'),
            );
            if (audioEnc) {
              audioUrl = audioEnc.url;
              break;
            }
          }

          if (!audioUrl) {
            done({ success: false, error: 'No podcast audio URL available' });
            return;
          }

          const audio = new Audio();
          let settled = false;

          const timeout = setTimeout(() => {
            if (!settled) {
              settled = true;
              audio.pause();
              done({
                success: false,
                error: 'Timeout (20s) waiting for audio to play',
                currentTime: audio.currentTime,
                duration: audio.duration,
                paused: audio.paused,
                networkState: audio.networkState,
                readyState: audio.readyState,
                errorCode: audio.error?.code,
                errorMessage: audio.error?.message,
                url: audioUrl.substring(0, 100),
              });
              audio.src = '';
            }
          }, 20000);

          audio.addEventListener('error', () => {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              done({
                success: false,
                error: `Audio error: code=${audio.error?.code} message=${audio.error?.message}`,
                url: audioUrl.substring(0, 100),
              });
            }
          });

          audio.addEventListener('timeupdate', () => {
            if (!settled && audio.currentTime > 0.1) {
              settled = true;
              clearTimeout(timeout);
              const playResult = {
                success: true,
                currentTime: audio.currentTime,
                duration: audio.duration,
                paused: audio.paused,
                url: audioUrl.substring(0, 100),
              };
              audio.pause();
              audio.src = '';
              done(playResult);
            }
          });

          audio.src = audioUrl;
          try {
            await audio.play();
          } catch (err) {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              done({
                success: false,
                error: `play() rejected: ${err}`,
                url: audioUrl.substring(0, 100),
              });
            }
          }
        } catch (err) {
          done({ success: false, error: String(err) });
        }
      });

      console.log(
        '\n=== Audio Playback Test ===\n' +
          JSON.stringify(result, null, 2),
      );

      expect(result.success).toBe(true);
    });
  });
});
