import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Entry } from '@/lib/bindings';
import { usePlayerStore } from '@/store/player-store';
import { fireEvent, render, screen } from '@/test/test-utils';
import { EntryReadingHeader } from './EntryReadingHeader';

const sampleEntry: Entry = {
  id: 'entry-1',
  // biome-ignore lint/style/useNamingConvention: Miniflux API field name
  user_id: '1',
  // biome-ignore lint/style/useNamingConvention: Miniflux API field name
  feed_id: '1',
  title: 'Entry title',
  url: 'https://example.com/articles/1',
  // biome-ignore lint/style/useNamingConvention: Miniflux API field name
  comments_url: null,
  author: 'Author',
  content: '<p>hello</p>',
  hash: 'hash',
  // biome-ignore lint/style/useNamingConvention: Miniflux API field name
  published_at: '2026-02-19T00:00:00Z',
  // biome-ignore lint/style/useNamingConvention: Miniflux API field name
  created_at: null,
  // biome-ignore lint/style/useNamingConvention: Miniflux API field name
  changed_at: null,
  status: 'unread',
  // biome-ignore lint/style/useNamingConvention: Miniflux API field name
  share_code: null,
  starred: false,
  // biome-ignore lint/style/useNamingConvention: Miniflux API field name
  reading_time: 3,
  enclosures: [],
  feed: {
    id: '1',
    // biome-ignore lint/style/useNamingConvention: Miniflux API field name
    user_id: '1',
    title: 'Feed title',
    // biome-ignore lint/style/useNamingConvention: Miniflux API field name
    site_url: 'https://example.com',
    // biome-ignore lint/style/useNamingConvention: Miniflux API field name
    feed_url: 'https://example.com/feed.xml',
    category: null,
    icon: null,
  },
  tags: [],
};

function renderHeader(overrides: { isExcludedFeed?: boolean; entry?: Entry } = {}) {
  i18n.load('en', {});
  i18n.activate('en');

  usePlayerStore.getState().dismiss();

  return render(
    <I18nProvider i18n={i18n}>
      <EntryReadingHeader
        entry={overrides.entry ?? sampleEntry}
        hasPrev={false}
        hasNext={false}
        onToggleStar={vi.fn()}
        isStarred={false}
        onToggleRead={vi.fn()}
        isRead={false}
        isTogglingRead={false}
        headerPadding={8 as never}
        smallTitleOpacity={1 as never}
        smallTitleHeight={32 as never}
        titleOpacity={1 as never}
        titleScale={1 as never}
        titleY={0 as never}
        titleMaxHeight={120 as never}
        translationEnabled={false}
        onTranslationEnabledChange={vi.fn()}
        translationDisplayMode="bilingual"
        onTranslationDisplayModeChange={vi.fn()}
        translationTargetLanguage="en"
        onTranslationTargetLanguageChange={vi.fn()}
        activeTranslationProvider={null}
        isExcludedFeed={overrides.isExcludedFeed ?? false}
        onSummarize={vi.fn()}
        isSummarizing={false}
        hasSummary={false}
      />
    </I18nProvider>
  );
}

describe('EntryReadingHeader translation options', () => {
  afterEach(() => {
    usePlayerStore.getState().dismiss();
  });

  it('does not render per-entry auto translate toggle', async () => {
    renderHeader();

    fireEvent.click(await screen.findByRole('button', { name: 'Translation options' }));

    expect(screen.queryByText('Auto for this article')).not.toBeInTheDocument();
  });

  it('shows excluded feed notice when feed is excluded', async () => {
    renderHeader({ isExcludedFeed: true });

    fireEvent.click(await screen.findByRole('button', { name: 'Translation options' }));

    expect(screen.getByText('Translation disabled for this feed')).toBeInTheDocument();
    expect(screen.queryByText('Translate now')).not.toBeInTheDocument();
  });

  it('shows translate toggle when feed is not excluded', async () => {
    renderHeader({ isExcludedFeed: false });

    fireEvent.click(await screen.findByRole('button', { name: 'Translation options' }));

    expect(screen.queryByText('Translation disabled for this feed')).not.toBeInTheDocument();
    expect(screen.getByText('Translate now')).toBeInTheDocument();
  });

  it('shows podcast play button on header right when entry has audio enclosure', async () => {
    const podcastEntry: Entry = {
      ...sampleEntry,
      enclosures: [
        {
          id: 'enc-1',
          // biome-ignore lint/style/useNamingConvention: Miniflux API field name
          entry_id: 'entry-1',
          url: 'https://example.com/audio.mp3',
          // biome-ignore lint/style/useNamingConvention: Miniflux API field name
          mime_type: 'audio/mpeg',
          length: '1800',
          position: 0,
        },
      ],
    };

    renderHeader({ entry: podcastEntry });

    expect(await screen.findByTestId('entry-header-podcast-play')).toBeInTheDocument();
  });
});
