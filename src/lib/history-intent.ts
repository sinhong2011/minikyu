/**
 * Phone reader close is owned by the Drawer (swipe / ✕), not Safari Back.
 * These helpers only ignore a leftover `?entry=` if iOS still echoes one.
 */

let lastClosedEntry: string | null = null;
let readerOpenRequested = false;

const READER_BROWSER_BACK_CHROME =
  '[data-testid="mobile-reader-overlay"], .app-fixed-bottom-bar';

export function hideReaderChromeForBrowserBack(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.readerBrowserBack = '';
  document.querySelectorAll(READER_BROWSER_BACK_CHROME).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.setProperty('display', 'none', 'important');
    node.setAttribute('hidden', '');
  });
}

export function restoreReaderChromeUi(): void {
  if (typeof document === 'undefined') return;
  delete document.documentElement.dataset.readerBrowserBack;
  document.querySelectorAll(READER_BROWSER_BACK_CHROME).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.removeProperty('display');
    node.removeAttribute('hidden');
  });
}

export function clearReaderBrowserBackUi(): void {
  restoreReaderChromeUi();
}

export function isReaderChromeHidden(): boolean {
  return typeof document !== 'undefined' && 'readerBrowserBack' in document.documentElement.dataset;
}

export function markReaderOpenRequested(): void {
  readerOpenRequested = true;
  restoreReaderChromeUi();
}

export function rememberReaderClosed(id: string): void {
  lastClosedEntry = id;
}

export function clearReaderClosed(): void {
  lastClosedEntry = null;
}

export function consumeReaderOpenRequested(): boolean {
  const requested = readerOpenRequested;
  readerOpenRequested = false;
  return requested;
}

export function isReaderEntryEcho(entryId: string | undefined): boolean {
  if (!entryId || readerOpenRequested || !lastClosedEntry) return false;
  return lastClosedEntry === entryId;
}

export function resetHistoryIntent(): void {
  lastClosedEntry = null;
  readerOpenRequested = false;
  if (typeof document !== 'undefined') {
    restoreReaderChromeUi();
  }
}

export function recordPop(): void {
  hideReaderChromeForBrowserBack();
}
