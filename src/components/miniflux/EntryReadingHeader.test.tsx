import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import type { Entry } from '@/lib/bindings';
import { EntryReadingHeader } from './EntryReadingHeader';

vi.mock('@/hooks/use-reader-settings', () => ({
  useReaderSettings: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn(),
}));

vi.mock('./ReaderSettings', () => ({
  // biome-ignore lint/style/useNamingConvention: mock module export name
  ReaderSettings: () => <div data-testid="reader-settings" />,
}));

i18n.load('en', {});
i18n.activate('en');

const mockEntry = {
  id: '1',
  title: 'Test Entry',
  url: 'https://example.com/entry',
  author: 'Author',
  content: '<p>Summary</p>',
  status: 'unread',
  starred: false,
  feed: {
    title: 'Test Feed',
  },
} as unknown as Entry;

(mockEntry as any).share_code = null;
(mockEntry as any).published_at = '2026-02-21T10:00:00Z';
(mockEntry as any).reading_time = 5;
(mockEntry as any).feed.site_url = 'https://example.com';

function renderHeader(overrides?: Partial<React.ComponentProps<typeof EntryReadingHeader>>) {
  const onFetchOriginalContent = vi.fn();

  render(
    <I18nProvider i18n={i18n}>
      <EntryReadingHeader
        entry={mockEntry}
        hasPrev
        hasNext
        onToggleStar={vi.fn()}
        onToggleRead={vi.fn()}
        onFetchOriginalContent={onFetchOriginalContent}
        isRead={false}
        isTogglingRead={false}
        isFetchingOriginalContent={false}
        isOriginalContentDownloaded={false}
        headerPadding={0 as any}
        smallTitleOpacity={1 as any}
        smallTitleHeight={32 as any}
        titleOpacity={1 as any}
        titleScale={1 as any}
        titleY={0 as any}
        titleMaxHeight={120 as any}
        {...overrides}
      />
    </I18nProvider>
  );

  return { onFetchOriginalContent };
}

describe('EntryReadingHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useReaderSettings as any).mockReturnValue({
      chineseConversionMode: 'off',
      bionicReading: false,
      codeTheme: 'auto',
      readerTheme: 'default',
      statusBarVisible: true,
      setChineseConversionMode: vi.fn(),
      setBionicReading: vi.fn(),
      setCodeTheme: vi.fn(),
      setReaderTheme: vi.fn(),
      setStatusBarVisible: vi.fn(),
      isLoading: false,
    });
  });

  it('calls fetch handler when download original content button is clicked', () => {
    const { onFetchOriginalContent } = renderHeader();

    const button = screen.getByRole('button', { name: 'Download original content' });
    fireEvent.click(button);

    expect(onFetchOriginalContent).toHaveBeenCalledTimes(1);
  });

  it('disables download button while original content is being fetched', () => {
    renderHeader({ isFetchingOriginalContent: true });

    const button = screen.getByRole('button', { name: 'Fetching original content...' });
    expect(button).toBeDisabled();
  });

  it('shows downloaded status after original content is fetched', () => {
    renderHeader({ isOriginalContentDownloaded: true });

    const button = screen.getByRole('button', { name: 'Original content downloaded' });
    expect(button).not.toBeDisabled();
  });
});
