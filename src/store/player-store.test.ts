import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Enclosure, Entry } from '@/lib/tauri-bindings';

function createEntry(): Entry {
  return {
    id: 'entry-1',
    user_id: '1',
    feed_id: '1',
    title: 'Test episode',
    url: 'https://example.com/episode/1',
    hash: 'hash-1',
    published_at: '2026-02-25T00:00:00Z',
    status: 'unread',
    feed: {
      id: '1',
      user_id: '1',
      title: 'Test feed',
      site_url: 'https://example.com',
      feed_url: 'https://example.com/feed.xml',
      category: null,
      icon: null,
    },
    enclosures: [],
  };
}

function createEnclosure(): Enclosure {
  return {
    id: 'enc-1',
    entry_id: 'entry-1',
    url: 'https://example.com/audio.mp3',
    mime_type: 'audio/mpeg',
    length: '1800',
    position: 0,
  };
}

async function loadStore() {
  const { usePlayerStore } = await import('./player-store');
  return usePlayerStore;
}

describe('player-store', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('starts with no active entry', async () => {
    const store = await loadStore();
    expect(store.getState().currentEntry).toBeNull();
    expect(store.getState().isPlaying).toBe(false);
  });

  it('sets entry and enclosure on play', async () => {
    const store = await loadStore();
    const entry = createEntry();
    const enclosure = createEnclosure();

    store.getState().play(entry, enclosure);

    expect(store.getState().currentEntry).toBe(entry);
    expect(store.getState().currentEnclosure).toBe(enclosure);
    expect(store.getState().isPlaying).toBe(true);
    expect(store.getState().isBuffering).toBe(true);
  });

  it('clears state on dismiss', async () => {
    const store = await loadStore();
    store.getState().play(createEntry(), createEnclosure());
    store.getState().dismiss();

    expect(store.getState().currentEntry).toBeNull();
    expect(store.getState().currentEnclosure).toBeNull();
    expect(store.getState().isPlaying).toBe(false);
    expect(store.getState().currentTime).toBe(0);
    expect(store.getState().duration).toBe(0);
  });

  it('toggles mute', async () => {
    const store = await loadStore();
    expect(store.getState().isMuted).toBe(false);

    store.getState().toggleMute();
    expect(store.getState().isMuted).toBe(true);

    store.getState().toggleMute();
    expect(store.getState().isMuted).toBe(false);
  });

  it('sets playback speed', async () => {
    const store = await loadStore();
    store.getState().setSpeed(1.5);
    expect(store.getState().playbackSpeed).toBe(1.5);
  });

  it('seeks to position', async () => {
    const store = await loadStore();
    store.getState().seek(42);
    expect(store.getState().currentTime).toBe(42);
  });
});
