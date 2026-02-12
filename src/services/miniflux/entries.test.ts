import { describe, expect, it } from 'vitest';
import { getNextEntriesOffset } from './entries';

describe('getNextEntriesOffset', () => {
  it('returns next offset when loaded entries are below total', () => {
    const nextOffset = getNextEntriesOffset([
      { total: '250', entries: new Array(100).fill({}) },
      { total: '250', entries: new Array(100).fill({}) },
    ]);

    expect(nextOffset).toBe(200);
  });

  it('returns undefined when all entries are loaded', () => {
    const nextOffset = getNextEntriesOffset([
      { total: '200', entries: new Array(100).fill({}) },
      { total: '200', entries: new Array(100).fill({}) },
    ]);

    expect(nextOffset).toBeUndefined();
  });

  it('returns undefined when total is invalid', () => {
    const nextOffset = getNextEntriesOffset([
      { total: 'invalid', entries: new Array(10).fill({}) },
    ]);

    expect(nextOffset).toBeUndefined();
  });

  it('returns undefined when the last page is empty', () => {
    const nextOffset = getNextEntriesOffset([
      { total: '300', entries: new Array(100).fill({}) },
      { total: '300', entries: [] },
    ]);

    expect(nextOffset).toBeUndefined();
  });
});
