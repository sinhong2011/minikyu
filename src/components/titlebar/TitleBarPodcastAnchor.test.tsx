import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Enclosure, Entry } from '@/lib/tauri-bindings';
import { usePlayerStore } from '@/store/player-store';
import { act, render, screen } from '@/test/test-utils';
import { TitleBarPodcastAnchor } from './TitleBarPodcastAnchor';

vi.mock('@/lib/tauri-bindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri-bindings')>();
  return {
    ...actual,
    commands: {
      ...actual.commands,
      getFeedIconData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
      togglePlayerWindow: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    },
  };
});

function createEntry(): Entry {
  return {
    id: 'entry-1',
    // biome-ignore lint/style/useNamingConvention: Miniflux API field name
    user_id: '1',
    // biome-ignore lint/style/useNamingConvention: Miniflux API field name
    feed_id: '1',
    title: 'Podcast test title',
    url: 'https://example.com/episode/1',
    hash: 'hash-entry-1',
    // biome-ignore lint/style/useNamingConvention: Miniflux API field name
    published_at: '2026-02-25T00:00:00Z',
    status: 'unread',
    feed: {
      id: '1',
      // biome-ignore lint/style/useNamingConvention: Miniflux API field name
      user_id: '1',
      title: 'Podcast feed',
      // biome-ignore lint/style/useNamingConvention: Miniflux API field name
      site_url: 'https://example.com',
      // biome-ignore lint/style/useNamingConvention: Miniflux API field name
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
    // biome-ignore lint/style/useNamingConvention: Miniflux API field name
    entry_id: 'entry-1',
    url: 'https://example.com/audio.mp3',
    // biome-ignore lint/style/useNamingConvention: Miniflux API field name
    mime_type: 'audio/mpeg',
    length: '1800',
    position: 0,
  };
}

function renderAnchor() {
  i18n.load('en', {});
  i18n.activate('en');

  return render(
    <I18nProvider i18n={i18n}>
      <TitleBarPodcastAnchor />
    </I18nProvider>
  );
}

describe('TitleBarPodcastAnchor', () => {
  afterEach(() => {
    usePlayerStore.getState().dismiss();
  });

  it('renders nothing when no podcast is active', () => {
    renderAnchor();
    expect(screen.queryByTestId('titlebar-podcast-icon')).not.toBeInTheDocument();
  });

  it('renders capsule with playback progress', () => {
    act(() => {
      const { play, _setBuffering, _updateDuration, _updateTime } = usePlayerStore.getState();
      play(createEntry(), createEnclosure());
      _updateDuration(300);
      _updateTime(75);
      _setBuffering(false);
    });
    renderAnchor();

    const trigger = screen.getByTestId('titlebar-podcast-icon');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveClass('rounded-full');
    expect(screen.getByText('Podcast test title')).toBeInTheDocument();
    expect(screen.getByText('1:15 / 5:00')).toBeInTheDocument();
  });

  it('calls togglePlayerWindow when capsule is clicked', async () => {
    const { commands } = await import('@/lib/tauri-bindings');
    act(() => {
      usePlayerStore.getState().play(createEntry(), createEnclosure());
    });
    renderAnchor();

    const trigger = screen.getByTestId('titlebar-podcast-icon');
    act(() => {
      trigger.click();
    });

    expect(commands.togglePlayerWindow).toHaveBeenCalled();
  });
});
