import { describe, expect, it } from 'vitest';
import {
  defaultReaderFontFamily,
  getReaderFontStack,
  isCustomReaderFont,
  isReaderFontFamily,
  normalizeReaderFontFamily,
  readerFontFamilies,
} from './reader-fonts';

describe('reader-fonts', () => {
  it('recognizes supported reader font families', () => {
    expect(isReaderFontFamily('sans-serif')).toBe(true);
    expect(isReaderFontFamily('georgia')).toBe(true);
    expect(isReaderFontFamily('unknown')).toBe(false);
  });

  it('normalizes missing or unsupported font families to default', () => {
    expect(normalizeReaderFontFamily(undefined)).toBe(defaultReaderFontFamily);
    expect(normalizeReaderFontFamily(null)).toBe(defaultReaderFontFamily);
    expect(normalizeReaderFontFamily('invalid-font')).toBe(defaultReaderFontFamily);
  });

  it('returns a non-empty CSS stack for every supported font family', () => {
    for (const family of readerFontFamilies) {
      expect(getReaderFontStack(family).length).toBeGreaterThan(0);
    }
  });

  it('returns a quoted font stack for custom system fonts', () => {
    const stack = getReaderFontStack('Helvetica Neue');
    expect(stack).toContain('"Helvetica Neue"');
    expect(stack).toContain('sans-serif');
  });

  it('identifies custom reader fonts', () => {
    expect(isCustomReaderFont('Helvetica Neue')).toBe(true);
    expect(isCustomReaderFont('sans-serif')).toBe(false);
    expect(isCustomReaderFont(null)).toBe(false);
    expect(isCustomReaderFont(undefined)).toBe(false);
  });
});
