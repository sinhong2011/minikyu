export const readerFontFamilies = [
  'sans-serif',
  'raleway',
  'system-ui',
  'humanist',
  'serif',
  'georgia',
  'book-serif',
  'monospace',
] as const;

export type ReaderFontFamily = (typeof readerFontFamilies)[number];

export const defaultReaderFontFamily: ReaderFontFamily = 'sans-serif';

const READER_FONT_FAMILY_SET = new Set<string>(readerFontFamilies);

const READER_FONT_STACKS: Record<ReaderFontFamily, string> = {
  'sans-serif':
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", "Helvetica Neue", Arial, sans-serif',
  raleway:
    '"Raleway Variable", "Avenir Next", "Segoe UI", "Noto Sans", "Helvetica Neue", Arial, sans-serif',
  'system-ui':
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", "Helvetica Neue", Arial, sans-serif',
  humanist:
    '"Gill Sans", "Trebuchet MS", "Segoe UI", "Noto Sans", "Helvetica Neue", Arial, sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif',
  georgia: 'Georgia, Cambria, "Times New Roman", Times, serif',
  'book-serif': 'Charter, "Bitstream Charter", "Sitka Text", "Book Antiqua", serif',
  monospace:
    'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
};

export function isReaderFontFamily(value: string): value is ReaderFontFamily {
  return READER_FONT_FAMILY_SET.has(value);
}

export function normalizeReaderFontFamily(value: string | null | undefined): ReaderFontFamily {
  if (!value) {
    return defaultReaderFontFamily;
  }

  return isReaderFontFamily(value) ? value : defaultReaderFontFamily;
}

export function getReaderFontStack(value: string | null | undefined): string {
  return READER_FONT_STACKS[normalizeReaderFontFamily(value)];
}
