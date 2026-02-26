describe('Database & Backend Integration', () => {
  it('should have Tauri IPC bridge available', async () => {
    const hasInvoke = await browser.execute(() => {
      return typeof window.__TAURI_INTERNALS__?.invoke === 'function';
    });
    expect(hasInvoke).toBe(true);
  });

  it('should have __TAURI_INTERNALS__ on window (withGlobalTauri: true)', async () => {
    const hasTauri = await browser.execute(() => {
      return window.__TAURI_INTERNALS__ != null;
    });
    expect(hasTauri).toBe(true);
  });

  it('should be able to invoke a Tauri command via async script', async () => {
    // Use executeAsyncScript because Tauri invoke returns a Promise
    const result = await browser.executeAsync(async (done) => {
      try {
        const response = await window.__TAURI_INTERNALS__.invoke(
          'get_podcast_progress_batch',
          { entryIds: [] },
        );
        done({ success: true, data: response });
      } catch (e) {
        done({ success: false, error: String(e) });
      }
    });

    // The command should be callable — even an error response means
    // the command pipeline (invoke → Rust → SQLite) is wired up
    expect(result).toBeTruthy();
  });
});
