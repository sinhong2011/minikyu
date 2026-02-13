export const readerThemeOptions = ['default', 'paper', 'sepia', 'slate', 'oled'] as const;

export type ReaderTheme = (typeof readerThemeOptions)[number];

interface ReaderThemePalette {
  surface: string;
  text: string;
  muted: string;
  border: string;
  link: string;
}

const READER_THEME_SET = new Set<string>(readerThemeOptions);

const READER_THEME_PALETTES: Record<ReaderTheme, ReaderThemePalette> = {
  default: {
    surface: 'hsl(var(--background))',
    text: 'hsl(var(--foreground))',
    muted: 'hsl(var(--muted-foreground))',
    border: 'hsl(var(--border))',
    link: 'hsl(var(--primary))',
  },
  paper: {
    surface: 'oklch(0.985 0.008 88)',
    text: 'oklch(0.31 0.01 80)',
    muted: 'oklch(0.52 0.014 80)',
    border: 'oklch(0.86 0.013 83)',
    link: 'oklch(0.42 0.1 64)',
  },
  sepia: {
    surface: 'oklch(0.94 0.023 73)',
    text: 'oklch(0.33 0.03 60)',
    muted: 'oklch(0.52 0.025 60)',
    border: 'oklch(0.8 0.03 68)',
    link: 'oklch(0.47 0.11 52)',
  },
  slate: {
    surface: 'oklch(0.23 0.016 264)',
    text: 'oklch(0.9 0.01 255)',
    muted: 'oklch(0.7 0.015 255)',
    border: 'oklch(0.38 0.015 260)',
    link: 'oklch(0.78 0.11 220)',
  },
  oled: {
    surface: 'oklch(0.14 0 0)',
    text: 'oklch(0.93 0 0)',
    muted: 'oklch(0.68 0 0)',
    border: 'oklch(0.3 0 0)',
    link: 'oklch(0.82 0.08 220)',
  },
};

export function normalizeReaderTheme(value: string | null | undefined): ReaderTheme {
  if (!value) {
    return 'default';
  }

  return READER_THEME_SET.has(value) ? (value as ReaderTheme) : 'default';
}

export function getReaderThemePalette(value: string | null | undefined): ReaderThemePalette {
  return READER_THEME_PALETTES[normalizeReaderTheme(value)];
}
