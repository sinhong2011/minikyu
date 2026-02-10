import { describe, expect, it } from 'vitest';
import {
  formatEntryTime,
  getEntryDateSectionType,
  groupEntriesByCalendarDate,
  parseDateInput,
} from './miniflux-utils';

function createTestEntry(id: string, publishedAt: string) {
  return {
    id,
    // biome-ignore lint/style/useNamingConvention: matches Miniflux API shape
    published_at: publishedAt,
  };
}

describe('miniflux-utils', () => {
  it('parses ISO date input', () => {
    const parsed = parseDateInput('2026-01-09T08:05:00');
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
  });

  it('formats entry time as HH:mm', () => {
    expect(formatEntryTime('2026-01-09T06:07:00')).toBe('06:07');
  });

  it('returns section type by relative day', () => {
    const now = new Date(2026, 1, 10, 12, 0, 0);

    expect(getEntryDateSectionType(new Date(2026, 1, 10, 8, 0, 0), now)).toBe('today');
    expect(getEntryDateSectionType(new Date(2026, 1, 9, 8, 0, 0), now)).toBe('yesterday');
    expect(getEntryDateSectionType(new Date(2026, 1, 8, 8, 0, 0), now)).toBe('weekday');
    expect(getEntryDateSectionType(new Date(2026, 0, 15, 8, 0, 0), now)).toBe('full-date');
  });

  it('groups entries by published calendar date while preserving order', () => {
    const entries = [
      createTestEntry('1', '2026-02-10T09:00:00'),
      createTestEntry('2', '2026-02-10T07:00:00'),
      createTestEntry('3', '2026-02-09T21:00:00'),
    ];

    const groups = groupEntriesByCalendarDate(entries);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.key).toBe('2026-02-10');
    expect(groups[0]?.entries.map((entry) => entry.id)).toEqual(['1', '2']);
    expect(groups[1]?.key).toBe('2026-02-09');
    expect(groups[1]?.entries.map((entry) => entry.id)).toEqual(['3']);
  });
});
