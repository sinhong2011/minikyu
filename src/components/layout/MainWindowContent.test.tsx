import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const selected = vi.hoisted(() => ({ id: '1536612' as string | undefined }));
const historyIntent = vi.hoisted(() => ({ browserBack: false }));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => true,
}));

vi.mock('@/hooks/use-selected-entry', () => ({
  useSelectedEntryId: () => selected.id,
}));

vi.mock('@/hooks/use-in-app-browser', () => ({
  useInAppBrowser: () => ({
    openBrowser: vi.fn(),
    closeBrowser: vi.fn(),
    browserContentRef: { current: null },
    inAppBrowserUrl: null,
  }),
}));

vi.mock('@/services/preferences', () => ({
  usePreferences: () => ({ data: { layout_entry_list_width: 435 } }),
  useSavePreferences: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/lib/history-intent', () => ({
  wasBrowserInitiatedBack: () => historyIntent.browserBack,
}));

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

vi.mock('@/components/miniflux/EntryReading', () => ({
  EntryReading: () => <div data-testid="entry-reading">article</div>,
}));

vi.mock('@/components/miniflux/EntryEmptyState', () => ({
  EntryEmptyState: () => null,
}));

vi.mock('@/components/miniflux/InAppBrowserPane', () => ({
  InAppBrowserPane: () => null,
}));

vi.mock('@/components/layout/MobileTabBar', () => ({
  MobileTabBar: () => null,
}));

import { MainWindowContent } from './MainWindowContent';

describe('MainWindowContent phone reader swipe-back', () => {
  beforeEach(() => {
    selected.id = '1536612';
    historyIntent.browserBack = false;
  });

  it('skips the slide-out when Safari already animated the edge-swipe', async () => {
    const { rerender } = render(
      <MainWindowContent>
        <div>list</div>
      </MainWindowContent>
    );

    expect(screen.getByTestId('mobile-reader-overlay')).toHaveAttribute(
      'data-reader-exit',
      'slide'
    );

    historyIntent.browserBack = true;
    selected.id = undefined;
    rerender(
      <MainWindowContent>
        <div>list</div>
      </MainWindowContent>
    );

    await waitFor(() => {
      expect(screen.getByTestId('mobile-reader-overlay')).toHaveAttribute(
        'data-reader-exit',
        'instant'
      );
    });

    // Safari already slid the page away; our overlay must not linger for 340ms.
    await waitFor(
      () => {
        expect(screen.queryByTestId('mobile-reader-overlay')).not.toBeInTheDocument();
      },
      { timeout: 150 }
    );
  });

  it('keeps the 340ms slide-out when the ✕ asked for the pop', async () => {
    const { rerender } = render(
      <MainWindowContent>
        <div>list</div>
      </MainWindowContent>
    );

    historyIntent.browserBack = false;
    selected.id = undefined;
    rerender(
      <MainWindowContent>
        <div>list</div>
      </MainWindowContent>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });

    const overlay = screen.getByTestId('mobile-reader-overlay');
    expect(overlay).toHaveAttribute('data-reader-exit', 'slide');
    expect(overlay).toBeInTheDocument();
  });
});
