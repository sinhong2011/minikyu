import { beforeEach, describe, expect, it } from 'vitest';
import {
  markAppInitiatedBack,
  resetHistoryIntent,
  wasBrowserInitiatedBack,
} from '@/lib/history-intent';

/** The listener the module installs on import does the classifying. */
function pop() {
  window.dispatchEvent(new PopStateEvent('popstate'));
}

describe('history-intent', () => {
  beforeEach(() => {
    resetHistoryIntent();
  });

  it('reports nothing before any pop', () => {
    expect(wasBrowserInitiatedBack()).toBe(false);
  });

  it('flags a pop the app did not ask for', () => {
    // iOS Safari's edge-swipe Back is this path: the browser pops, then we
    // skip our 340ms reader exit so the gesture is the whole transition.
    pop();
    expect(wasBrowserInitiatedBack()).toBe(true);
  });

  it('stays quiet for a pop the app claimed', () => {
    markAppInitiatedBack();
    pop();
    expect(wasBrowserInitiatedBack()).toBe(false);
  });

  it('claims one pop only', () => {
    markAppInitiatedBack();
    pop();
    pop();
    expect(wasBrowserInitiatedBack()).toBe(true);
  });

  it('ignores pops older than the window', () => {
    pop();
    expect(wasBrowserInitiatedBack(-1)).toBe(false);
  });
});
