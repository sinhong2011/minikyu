import { beforeEach, describe, expect, it } from 'vitest';
import { useSyncStore } from './sync-store';

describe('SyncStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSyncStore.setState({
      syncing: false,
      lastSyncedAt: null,
      error: null,
      currentStage: 'idle',
      categoriesCount: undefined,
      feedsCount: undefined,
      entriesProgress: undefined,
    });
  });

  describe('initial state', () => {
    it('has correct initial state', () => {
      const state = useSyncStore.getState();
      expect(state.syncing).toBe(false);
      expect(state.lastSyncedAt).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('syncing state', () => {
    it('sets syncing to true', () => {
      const { setSyncing } = useSyncStore.getState();

      setSyncing(true);
      expect(useSyncStore.getState().syncing).toBe(true);
    });

    it('sets syncing to false', () => {
      useSyncStore.setState({ syncing: true });
      const { setSyncing } = useSyncStore.getState();

      setSyncing(false);
      expect(useSyncStore.getState().syncing).toBe(false);
    });

    it('clears error when syncing starts', () => {
      useSyncStore.setState({ error: 'Previous error' });
      const { setSyncing } = useSyncStore.getState();

      setSyncing(true);
      expect(useSyncStore.getState().error).toBeNull();
    });
  });

  describe('lastSyncedAt state', () => {
    it('sets lastSyncedAt timestamp', () => {
      const { setLastSyncedAt } = useSyncStore.getState();
      const now = new Date();

      setLastSyncedAt(now);
      expect(useSyncStore.getState().lastSyncedAt).toEqual(now);
    });

    it('clears lastSyncedAt with null', () => {
      useSyncStore.setState({ lastSyncedAt: new Date() });
      const { setLastSyncedAt } = useSyncStore.getState();

      setLastSyncedAt(null);
      expect(useSyncStore.getState().lastSyncedAt).toBeNull();
    });
  });

  describe('error state', () => {
    it('sets error message', () => {
      const { setError } = useSyncStore.getState();

      setError('Sync failed');
      expect(useSyncStore.getState().error).toBe('Sync failed');
    });

    it('clears error with null', () => {
      useSyncStore.setState({ error: 'Previous error' });
      const { setError } = useSyncStore.getState();

      setError(null);
      expect(useSyncStore.getState().error).toBeNull();
    });

    it('sets syncing to false when error is set', () => {
      useSyncStore.setState({ syncing: true });
      const { setError } = useSyncStore.getState();

      setError('Network error');
      expect(useSyncStore.getState().syncing).toBe(false);
    });
  });

  describe('startSync action', () => {
    it('sets syncing true and clears error', () => {
      useSyncStore.setState({
        syncing: false,
        error: 'Previous error',
        currentStage: 'entries',
        categoriesCount: 10,
        feedsCount: 55,
        entriesProgress: { pulled: 30, total: 100, percentage: 30 },
      });
      const { startSync } = useSyncStore.getState();

      startSync();
      const state = useSyncStore.getState();
      expect(state.syncing).toBe(true);
      expect(state.error).toBeNull();
      expect(state.currentStage).toBe('idle');
      expect(state.categoriesCount).toBeUndefined();
      expect(state.feedsCount).toBeUndefined();
      expect(state.entriesProgress).toBeUndefined();
    });
  });

  describe('completeSync action', () => {
    it('sets syncing false and updates lastSyncedAt', () => {
      useSyncStore.setState({ syncing: true });
      const { completeSync } = useSyncStore.getState();
      const beforeComplete = new Date();

      completeSync();

      const state = useSyncStore.getState();
      expect(state.syncing).toBe(false);
      expect(state.lastSyncedAt).not.toBeNull();
      expect(state.lastSyncedAt?.getTime()).toBeGreaterThanOrEqual(beforeComplete.getTime());
    });
  });

  describe('failSync action', () => {
    it('sets syncing false and sets error', () => {
      useSyncStore.setState({ syncing: true });
      const { failSync } = useSyncStore.getState();

      failSync('Connection timeout');

      const state = useSyncStore.getState();
      expect(state.syncing).toBe(false);
      expect(state.error).toBe('Connection timeout');
    });
  });
});
