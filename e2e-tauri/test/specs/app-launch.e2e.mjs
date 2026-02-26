describe('App Launch', () => {
  it('should load the application with a title', async () => {
    const title = await browser.getTitle();
    expect(title).toBeTruthy();
  });

  it('should render the React root element', async () => {
    const root = await $('#root');
    expect(await root.isExisting()).toBe(true);
  });

  it('should have the Tauri IPC bridge available', async () => {
    const hasIpc = await browser.execute(() => {
      return typeof window.__TAURI_INTERNALS__?.invoke === 'function';
    });
    expect(hasIpc).toBe(true);
  });

  it('should have the test bridge with Zustand stores exposed', async () => {
    // Wait for dynamic import to complete
    await browser.waitUntil(
      async () => {
        return browser.execute(() => window.__TEST__ != null);
      },
      { timeout: 5000, timeoutMsg: 'Test bridge not loaded in time' },
    );

    const stores = await browser.execute(() => ({
      hasPlayerStore: typeof window.__TEST__?.playerStore?.getState === 'function',
      hasUiStore: typeof window.__TEST__?.uiStore?.getState === 'function',
    }));

    expect(stores.hasPlayerStore).toBe(true);
    expect(stores.hasUiStore).toBe(true);
  });
});
