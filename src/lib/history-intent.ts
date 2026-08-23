/**
 * Tells a Back *we* asked for apart from one the browser drove itself.
 *
 * Both land as the same `popstate`, but the phone reader has to treat them
 * differently. iOS Safari plays its own slide for the edge-swipe (and for its
 * toolbar Back), so replaying our exit on top of it shows the reader closing
 * twice — Safari's slide, then ours. The ✕ goes through `history.back()` too
 * and gets no such animation, so that one still needs ours.
 *
 * Kept as a module singleton rather than a store: the claim is made in
 * `MinifluxLayout` and read in `MainWindowContent`, it lives for a few
 * milliseconds, and nothing renders off it.
 */

let appInitiatedBack = false;
let appInitiatedTimer: ReturnType<typeof setTimeout> | null = null;
let lastBrowserBackAt = Number.NEGATIVE_INFINITY;

/** Claim the next `popstate` as ours. Call it right before `history.back()`. */
export function markAppInitiatedBack(): void {
  appInitiatedBack = true;
  if (appInitiatedTimer) clearTimeout(appInitiatedTimer);
  // A pop we asked for always arrives on the next task. Drop an unclaimed
  // marker so a later gesture is never mistaken for the call that never popped.
  appInitiatedTimer = setTimeout(() => {
    appInitiatedBack = false;
    appInitiatedTimer = null;
  }, 400);
}

/** True when the browser itself popped history within `withinMs`. */
export function wasBrowserInitiatedBack(withinMs = 400): boolean {
  return performance.now() - lastBrowserBackAt <= withinMs;
}

/** Test seam: forget both the claim and the last observed browser pop. */
export function resetHistoryIntent(): void {
  appInitiatedBack = false;
  if (appInitiatedTimer) clearTimeout(appInitiatedTimer);
  appInitiatedTimer = null;
  lastBrowserBackAt = Number.NEGATIVE_INFINITY;
}

/** Exported for tests; the listener below is the only production caller. */
export function recordPop(): void {
  if (appInitiatedBack) {
    appInitiatedBack = false;
    if (appInitiatedTimer) clearTimeout(appInitiatedTimer);
    appInitiatedTimer = null;
    return;
  }
  lastBrowserBackAt = performance.now();
}

if (typeof window !== 'undefined') {
  // Registered at import time, which is before the router builds its own
  // history listener — the reader's close effect must see the pop classified.
  window.addEventListener('popstate', recordPop);
}
