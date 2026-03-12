export const readerFontFamilies = [
  'sans-serif',
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
  if (!value) return READER_FONT_STACKS[defaultReaderFontFamily];
  if (isReaderFontFamily(value)) return READER_FONT_STACKS[value];
  // Custom system font — wrap in quotes and add sans-serif fallback
  return `"${value}", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
}

/** Returns true if the value is a custom (system) font rather than a preset. */
export function isCustomReaderFont(value: string | null | undefined): boolean {
  return !!value && !isReaderFontFamily(value);
}
