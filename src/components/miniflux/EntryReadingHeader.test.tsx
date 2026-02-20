import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { describe, expect, it, vi } from 'vitest';
import type { Entry } from '@/lib/bindings';
import { fireEvent, render, screen } from '@/test/test-utils';
import { EntryReadingHeader } from './EntryReadingHeader';

const sampleEntry: Entry = {
  id: 'entry-1',
  user_id: '1',
  feed_id: '1',
  title: 'Entry title',
  url: 'https://example.com/articles/1',
  comments_url: null,
  author: 'Author',
  content: '<p>hello</p>',
  hash: 'hash',
  published_at: '2026-02-19T00:00:00Z',
  created_at: null,
  changed_at: null,
  status: 'unread',
  share_code: null,
  starred: false,
  reading_time: 3,
  enclosures: [],
  feed: {
    id: '1',
    user_id: '1',
    title: 'Feed title',
    site_url: 'https://example.com',
    feed_url: 'https://example.com/feed.xml',
    category: null,
    icon: null,
  },
  tags: [],
};

function renderHeader() {
  i18n.load('en', {});
  i18n.activate('en');

  return render(
    <I18nProvider i18n={i18n}>
      <EntryReadingHeader
        entry={sampleEntry}
        hasPrev={false}
        hasNext={false}
        onToggleStar={vi.fn()}
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
      />
    </I18nProvider>
  );
}

describe('EntryReadingHeader translation options', () => {
  it('does not render per-entry auto translate toggle', async () => {
    renderHeader();

    fireEvent.click(await screen.findByRole('button', { name: 'Translation options' }));

    expect(screen.queryByText('Auto for this article')).not.toBeInTheDocument();
  });
});
