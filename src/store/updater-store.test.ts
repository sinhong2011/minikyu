import { beforeEach, describe, expect, it } from 'vitest';
import { useUpdaterStore } from './updater-store';

describe('updater-store', () => {
  beforeEach(() => {
    useUpdaterStore.setState({ status: 'idle' });
  });

  it('starts in idle state', () => {
    expect(useUpdaterStore.getState().status).toBe('idle');
  });

  it('transitions to checking', () => {
    useUpdaterStore.getState().setChecking();
    expect(useUpdaterStore.getState().status).toBe('checking');
  });

  it('transitions to available with metadata', () => {
    useUpdaterStore.getState().setAvailable('1.4.0', '2026-03-04', 'Bug fixes');
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('available');
    if (state.status === 'available') {
      expect(state.version).toBe('1.4.0');
      expect(state.date).toBe('2026-03-04');
      expect(state.body).toBe('Bug fixes');
    }
  });

  it('transitions to downloading with progress', () => {
    useUpdaterStore.getState().setDownloading('1.4.0', 45);
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('downloading');
    if (state.status === 'downloading') {
      expect(state.version).toBe('1.4.0');
      expect(state.progress).toBe(45);
    }
  });

  it('transitions to ready', () => {
    useUpdaterStore.getState().setReady('1.4.0');
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.version).toBe('1.4.0');
    }
  });

  it('transitions to error', () => {
    useUpdaterStore.getState().setError('Network failed');
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.message).toBe('Network failed');
    }
  });

  it('resets to idle', () => {
    useUpdaterStore.getState().setError('err');
    useUpdaterStore.getState().reset();
    expect(useUpdaterStore.getState().status).toBe('idle');
  });

  it('transitions to up-to-date', () => {
    useUpdaterStore.getState().setUpToDate();
    expect(useUpdaterStore.getState().status).toBe('up-to-date');
  });

  it('transitions to installing', () => {
    useUpdaterStore.getState().setInstalling();
    expect(useUpdaterStore.getState().status).toBe('installing');
  });
});
