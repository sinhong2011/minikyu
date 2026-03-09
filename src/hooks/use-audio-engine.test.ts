import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Enclosure, Entry } from '@/lib/tauri-bindings';

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    getPodcastProgress: vi.fn(async () => ({ status: 'ok', data: null })),
    savePodcastProgress: vi.fn(async () => ({ status: 'ok', data: null })),
    markEpisodeCompleted: vi.fn(async () => ({ status: 'ok', data: null })),
    getDownloadedFilePath: vi.fn(async () => ({ status: 'ok', data: null })),
    loadPreferences: vi.fn(async () => ({
      status: 'ok',
      data: { player_display_mode: 'FloatingWindow' },
    })),
    getFeedIconData: vi.fn(async () => ({ status: 'ok', data: null })),
    showPlayerWindow: vi.fn(async () => ({ status: 'ok', data: null })),
    showTrayPopover: vi.fn(async () => ({ status: 'ok', data: null })),
  },
}));

class MockAudio extends EventTarget {
  public currentTime = 0;
  public duration = Number.NaN;
  public playbackRate = 1;
  public volume = 1;
  public muted = false;
  public paused = true;
  public src = '';
  public error: MediaError | null = null;
  public buffered = {
    length: 0,
    end: () => 0,
  };

  public readonly play = vi.fn(async () => {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    this.dispatchEvent(new Event('playing'));
  });

  public readonly pause = vi.fn(() => {
    const wasPaused = this.paused;
    this.paused = true;
    if (!wasPaused) {
      this.dispatchEvent(new Event('pause'));
    }
  });

  public readonly removeAttribute = vi.fn((name: string) => {
    if (name === 'src') {
      this.src = '';
    }
  });
}

function createEntry(): Entry {
  return {
    id: '1001',
    user_id: '1',
    feed_id: '10',
    title: 'Episode 43',
    url: 'https://example.com/episodes/43',
    hash: 'hash-1001',
    published_at: '2026-02-25T00:00:00Z',
    status: 'unread',
    feed: {
      id: '10',
      user_id: '1',
      title: 'Podcast Feed',
      site_url: 'https://example.com',
      feed_url: 'https://example.com/feed.xml',
      category: null,
      icon: null,
    },
  };
}

function createEnclosure(): Enclosure {
  return {
    id: '2001',
    entry_id: '1001',
    url: 'https://cdn.example.com/audio/episode-43.mp3',
    mime_type: 'audio/mpeg',
    length: '3600',
    position: 0,
  };
}

function installRuntime(audio: MockAudio) {
  const runtime = globalThis as {
    minikyuAudioEngineRuntime?: {
      audio: HTMLAudioElement;
      mountCount: number;
      teardown: (() => void) | null;
    };
  };

  runtime.minikyuAudioEngineRuntime = {
    audio: audio as unknown as HTMLAudioElement,
    mountCount: 0,
    teardown: null,
  };
}

describe('useAudioEngine', () => {
  afterEach(() => {
    const runtime = globalThis as { minikyuAudioEngineRuntime?: unknown };
    delete runtime.minikyuAudioEngineRuntime;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('tears down runtime after the last mount unmounts', async () => {
    const audio = new MockAudio();
    installRuntime(audio);

    const { useAudioEngine } = await import('./use-audio-engine');
    const first = renderHook(() => useAudioEngine());
    const second = renderHook(() => useAudioEngine());

    first.unmount();
    second.unmount();

    const runtime = globalThis as {
      minikyuAudioEngineRuntime?: { mountCount: number; teardown: (() => void) | null };
    };
    expect(runtime.minikyuAudioEngineRuntime?.mountCount).toBe(0);
    expect(runtime.minikyuAudioEngineRuntime?.teardown).toBeNull();
    expect(audio.removeAttribute).toHaveBeenCalledWith('src');
  });

  it('does not update progress while loading or stalled', async () => {
    const audio = new MockAudio();
    installRuntime(audio);

    const { useAudioEngine } = await import('./use-audio-engine');
    const { usePlayerStore } = await import('@/store/player-store');
    const entry = createEntry();
    const enclosure = createEnclosure();

    renderHook(() => useAudioEngine());

    audio.buffered = {
      length: 1,
      end: () => 60,
    };

    act(() => {
      usePlayerStore.getState().play(entry, enclosure);
    });

    await waitFor(() => {
      expect(audio.play).toHaveBeenCalledTimes(1);
    });

    act(() => {
      audio.currentTime = 17;
      audio.dispatchEvent(new Event('waiting'));
      audio.dispatchEvent(new Event('timeupdate'));
    });
    expect(usePlayerStore.getState().currentTime).toBe(0);

    act(() => {
      audio.currentTime = 21;
      audio.dispatchEvent(new Event('playing'));
      audio.dispatchEvent(new Event('timeupdate'));
    });
    expect(usePlayerStore.getState().currentTime).toBe(21);

    act(() => {
      audio.pause();
      audio.currentTime = 30;
      audio.dispatchEvent(new Event('timeupdate'));
    });
    expect(usePlayerStore.getState().currentTime).toBe(21);
  });

  it('waits for initial buffering before autoplay starts', async () => {
    const audio = new MockAudio();
    installRuntime(audio);

    const { useAudioEngine } = await import('./use-audio-engine');
    const { usePlayerStore } = await import('@/store/player-store');
    const entry = createEntry();
    const enclosure = createEnclosure();

    renderHook(() => useAudioEngine());

    audio.buffered = {
      length: 0,
      end: () => 0,
    };

    act(() => {
      usePlayerStore.getState().play(entry, enclosure);
    });

    await waitFor(() => {
      expect(usePlayerStore.getState().isBuffering).toBe(true);
    });
    expect(audio.play).not.toHaveBeenCalled();

    audio.buffered = {
      length: 1,
      end: () => 2,
    };

    act(() => {
      audio.dispatchEvent(new Event('progress'));
    });
    expect(audio.play).not.toHaveBeenCalled();

    audio.buffered = {
      length: 1,
      end: () => 30,
    };

    act(() => {
      audio.dispatchEvent(new Event('progress'));
    });

    await waitFor(() => {
      expect(audio.play).toHaveBeenCalledTimes(1);
    });
  });

  it('saves progress before marking episode as completed when playback ends', async () => {
    const audio = new MockAudio();
    installRuntime(audio);

    const { useAudioEngine } = await import('./use-audio-engine');
    const { usePlayerStore } = await import('@/store/player-store');
    const { commands } = await import('@/lib/tauri-bindings');
    const entry = createEntry();
    const enclosure = createEnclosure();

    renderHook(() => useAudioEngine());

    audio.duration = 1800;
    audio.buffered = {
      length: 1,
      end: () => 1800,
    };

    act(() => {
      usePlayerStore.getState().play(entry, enclosure);
    });

    await waitFor(() => {
      expect(audio.play).toHaveBeenCalledTimes(1);
    });

    act(() => {
      audio.currentTime = 1800;
      audio.dispatchEvent(new Event('ended'));
    });

    await waitFor(() => {
      expect(commands.savePodcastProgress).toHaveBeenCalledWith(entry.id, 1800, 1800);
    });
    expect(commands.markEpisodeCompleted).toHaveBeenCalledWith(entry.id);
  });
});
