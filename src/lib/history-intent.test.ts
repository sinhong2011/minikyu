import { beforeEach, describe, expect, it } from 'vitest';
import {
  isReaderEntryEcho,
  markReaderOpenRequested,
  rememberReaderClosed,
  resetHistoryIntent,
} from '@/lib/history-intent';

describe('reader entry echo', () => {
  beforeEach(() => {
    resetHistoryIntent();
  });

  it('treats a returning id as an echo after a close', () => {
    rememberReaderClosed('1536612');
    expect(isReaderEntryEcho('1536612')).toBe(true);
    expect(isReaderEntryEcho('999')).toBe(false);
  });

  it('does not treat a deliberate open as an echo', () => {
    rememberReaderClosed('1536612');
    markReaderOpenRequested();
    expect(isReaderEntryEcho('1536612')).toBe(false);
  });
});
