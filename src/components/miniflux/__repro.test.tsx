import { i18n } from '@lingui/core';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import { render, screen, waitFor } from '@/test/test-utils';
import { ConnectionDialog } from './ConnectionDialog';

const minifluxConnect = vi.fn().mockResolvedValue({ status: 'ok', data: null });

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    minifluxConnect: (...args: unknown[]) => minifluxConnect(...args),
    getMinifluxAccounts: vi.fn().mockResolvedValue({ status: 'ok', data: [] }),
  },
  unwrapResult: vi.fn(),
}));

vi.mock('@/lib/account-reset', () => ({ resetAccountState: vi.fn().mockResolvedValue(undefined) }));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;
  i18n.load('en', {});
  i18n.activate('en');
});

describe('ConnectionDialog submit', () => {
  it('submits when server url + token are filled', async () => {
    const user = userEvent.setup();
    render(<ConnectionDialog open onOpenChange={() => {}} />);

    const urlInput = screen.getByPlaceholderText(/Select or enter server URL/i);
    await user.click(urlInput);
    await user.keyboard('https://miniflux.example.com');

    const tokenInput = document.querySelector('input[name="authToken"]') as HTMLInputElement;
    await user.click(tokenInput);
    await user.keyboard('secret-token');

    const connectBtn = screen.getByRole('button', { name: /^Connect$/i });
    await user.click(connectBtn);

    await waitFor(() => expect(minifluxConnect).toHaveBeenCalled(), { timeout: 3000 });
  });
});
