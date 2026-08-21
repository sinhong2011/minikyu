import { useRouterState } from '@tanstack/react-router';
import { getRouter } from '@/lib/router-ref';

/**
 * `?zen=` value meaning "open Zen Mode and draw an article". It is replaced by
 * the article's id as soon as one is picked, so the URL always names what is on
 * screen — and is therefore shareable and reload-safe.
 *
 * Entry ids are numeric strings, so this can never collide with one.
 */
export const ZEN_RANDOM = 'random';

function readZenParam(search: unknown): string | undefined {
  return (search as { zen?: string }).zen;
}

export interface ZenModeState {
  /** Zen Mode is open — `?zen=` is present, whatever its value. */
  enabled: boolean;
  /** The article on screen, or null while one is still being drawn. */
  entryId: string | null;
}

export function useZenMode(): ZenModeState {
  const zen = useRouterState({ select: (state) => readZenParam(state.location.search) });

  return {
    enabled: zen !== undefined,
    entryId: zen && zen !== ZEN_RANDOM ? zen : null,
  };
}

/**
 * True while the open Zen Mode owes its history entry to a push we made, so
 * closing can pop it and keep the stack balanced. Module-level rather than a
 * ref because opening (title bar, command palette, native menu) and closing
 * (the overlay itself) happen in different components.
 *
 * A session restored from `?zen=` on load never pushed, so closing there
 * replaces instead.
 */
let zenPushed = false;

/** Open Zen Mode. Pushes, so Back closes it rather than leaving the app. */
export function openZenMode(): void {
  zenPushed = true;
  getRouter().navigate({
    to: '/',
    search: (prev) => ({ ...prev, zen: ZEN_RANDOM }),
    resetScroll: false,
  });
}

export function closeZenMode(): void {
  const router = getRouter();

  if (zenPushed) {
    zenPushed = false;
    router.history.back();
    return;
  }

  router.navigate({
    to: '/',
    search: (prev) => ({ ...prev, zen: undefined }),
    replace: true,
    resetScroll: false,
  });
}

export function toggleZenMode(): void {
  if (readZenParam(getRouter().state.location.search) === undefined) {
    openZenMode();
  } else {
    closeZenMode();
  }
}

/**
 * Point Zen Mode at an article. Always replaces: Back should leave Zen Mode,
 * not walk back through the articles it has shown.
 */
export function setZenModeEntry(entryId: string | null): void {
  getRouter().navigate({
    to: '/',
    search: (prev) => ({ ...prev, zen: entryId ?? ZEN_RANDOM }),
    replace: true,
    resetScroll: false,
  });
}

/**
 * Forget the pushed-history bookkeeping — for closes that bypass
 * {@link closeZenMode}, such as a browser Back or an account switch.
 */
export function forgetZenModeHistory(): void {
  zenPushed = false;
}
