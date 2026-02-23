import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    resizeBrowserWebview: vi.fn().mockResolvedValue(undefined),
  },
}));

i18n.load('en', {});
i18n.activate('en');

// jsdom does not implement ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

import { InAppBrowserPane } from './InAppBrowserPane';

function renderPane(props: React.ComponentProps<typeof InAppBrowserPane>) {
  return render(
    <I18nProvider i18n={i18n}>
      <InAppBrowserPane {...props} />
    </I18nProvider>
  );
}

describe('InAppBrowserPane', () => {
  it('renders the URL in the toolbar', () => {
    renderPane({
      url: 'https://example.com/article',
      onClose: vi.fn(),
      browserContentRef: { current: null } as unknown as React.RefObject<HTMLDivElement>,
    });
    expect(screen.getByText('https://example.com/article')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    renderPane({
      url: 'https://example.com',
      onClose,
      browserContentRef: { current: null } as unknown as React.RefObject<HTMLDivElement>,
    });
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
