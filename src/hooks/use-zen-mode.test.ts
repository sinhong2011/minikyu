import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const routerMock = vi.hoisted(() => {
  const navigate = vi.fn();
  const back = vi.fn();
  return {
    navigate,
    back,
    search: {} as Record<string, unknown>,
    reset() {
      navigate.mockClear();
      back.mockClear();
      this.search = {};
    },
  };
});

vi.mock('@/lib/router-ref', () => ({
  getRouter: () => ({
    navigate: routerMock.navigate,
    history: { back: routerMock.back },
    state: { location: { search: routerMock.search } },
  }),
}));

import {
  closeZenMode,
  forgetZenModeHistory,
  openZenMode,
  setZenModeEntry,
  toggleZenMode,
  ZEN_RANDOM,
} from './use-zen-mode';

/** The search patch a navigate() call would produce, given the current URL. */
function patchFrom(call: number): Record<string, unknown> {
  const options = routerMock.navigate.mock.calls[call]?.[0] as {
    search: (prev: Record<string, unknown>) => Record<string, unknown>;
  };
  return options.search(routerMock.search);
}

describe('zen mode navigation', () => {
  beforeEach(() => {
    routerMock.reset();
    // The pushed-history flag is module state, so clear it between tests.
    forgetZenModeHistory();
  });

  it('opens with a history push so Back closes it', () => {
    openZenMode();

    expect(routerMock.navigate).toHaveBeenCalledTimes(1);
    expect(patchFrom(0)).toMatchObject({ zen: ZEN_RANDOM });
    expect(routerMock.navigate.mock.calls[0]?.[0]).not.toMatchObject({ replace: true });
  });

  it('pops the pushed entry on close rather than stacking another', () => {
    openZenMode();
    routerMock.search = { zen: ZEN_RANDOM };
    routerMock.navigate.mockClear();

    closeZenMode();

    expect(routerMock.back).toHaveBeenCalledTimes(1);
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });

  it('replaces on close when the session was restored from the URL', () => {
    // No open() this time — as on a reload straight into ?zen=<id>.
    routerMock.search = { zen: '1536612' };

    closeZenMode();

    expect(routerMock.back).not.toHaveBeenCalled();
    expect(patchFrom(0)).toMatchObject({ zen: undefined });
    expect(routerMock.navigate.mock.calls[0]?.[0]).toMatchObject({ replace: true });
  });

  it('does not pop twice after a close it did not perform', () => {
    openZenMode();
    // A browser Back or an account switch closed it behind our back.
    forgetZenModeHistory();
    routerMock.search = {};
    routerMock.navigate.mockClear();

    closeZenMode();

    expect(routerMock.back).not.toHaveBeenCalled();
    expect(routerMock.navigate).toHaveBeenCalledTimes(1);
  });

  it('toggles on the presence of the param', () => {
    routerMock.search = {};
    toggleZenMode();
    expect(patchFrom(0)).toMatchObject({ zen: ZEN_RANDOM });

    routerMock.reset();
    forgetZenModeHistory();
    routerMock.search = { zen: '1536612' };
    toggleZenMode();
    expect(patchFrom(0)).toMatchObject({ zen: undefined });
  });

  it('replaces when changing article, so Back leaves rather than rewinds', () => {
    routerMock.search = { zen: '1' };

    setZenModeEntry('2');

    expect(patchFrom(0)).toMatchObject({ zen: '2' });
    expect(routerMock.navigate.mock.calls[0]?.[0]).toMatchObject({ replace: true });
  });

  it('falls back to drawing a new article when handed no entry', () => {
    routerMock.search = { zen: '1' };

    setZenModeEntry(null);

    expect(patchFrom(0)).toMatchObject({ zen: ZEN_RANDOM });
  });
});
