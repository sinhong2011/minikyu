import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const selected = vi.hoisted(() => ({ id: '1536612' as string | undefined }));

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

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DrawerContent: ({
    children,
    ...props
  }: {
    children: ReactNode;
    'data-testid'?: string;
  }) => <div {...props}>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

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

i18n.load('en', {});
i18n.activate('en');

function renderPhone(ui: ReactNode) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe('MainWindowContent phone reader', () => {
  beforeEach(() => {
    selected.id = '1536612';
  });

  it('shows the drawer while ?entry= is set', () => {
    renderPhone(
      <MainWindowContent>
        <div>list</div>
      </MainWindowContent>
    );
    expect(screen.getByTestId('mobile-reader-overlay')).toBeInTheDocument();
  });

  it('closes the drawer when ?entry= clears', () => {
    const { rerender } = renderPhone(
      <MainWindowContent>
        <div>list</div>
      </MainWindowContent>
    );

    selected.id = undefined;
    rerender(
      <I18nProvider i18n={i18n}>
        <MainWindowContent>
          <div>list</div>
        </MainWindowContent>
      </I18nProvider>
    );

    expect(screen.queryByTestId('mobile-reader-overlay')).not.toBeInTheDocument();
  });
});
