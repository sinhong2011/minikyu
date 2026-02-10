import {
  type BundledLanguage,
  type BundledTheme,
  bundledThemesInfo,
  getSingletonHighlighter,
} from 'shiki';

const SHIKI_DEFAULT_THEMES = {
  light: 'github-light',
  dark: 'github-dark',
} as const satisfies Record<'light' | 'dark', BundledTheme>;

export type ReaderCodeTheme = 'auto' | BundledTheme;

const bundledThemeIds = bundledThemesInfo.map((theme) => theme.id).sort() as BundledTheme[];

export const readerCodeThemeOptions: ReaderCodeTheme[] = ['auto', ...bundledThemeIds];

const READER_CODE_THEME_SET = new Set<ReaderCodeTheme>(readerCodeThemeOptions);
const SHIKI_LOADABLE_THEMES = readerCodeThemeOptions.filter(
  (theme): theme is BundledTheme => theme !== 'auto'
);

const SHIKI_LANGUAGES = [
  'bash',
  'css',
  'cpp',
  'go',
  'html',
  'java',
  'javascript',
  'json',
  'jsx',
  'kotlin',
  'markdown',
  'python',
  'rust',
  'shellscript',
  'sql',
  'swift',
  'toml',
  'tsx',
  'typescript',
  'xml',
  'yaml',
] as const satisfies ReadonlyArray<BundledLanguage>;

const SHIKI_LANGUAGE_SET = new Set<BundledLanguage>(SHIKI_LANGUAGES);

const LANGUAGE_ALIASES: Record<string, SupportedCodeLanguage> = {
  cjs: 'javascript',
  'c++': 'cpp',
  go: 'go',
  js: 'javascript',
  jsonc: 'json',
  json5: 'json',
  kt: 'kotlin',
  plaintext: 'text',
  md: 'markdown',
  mts: 'typescript',
  plain: 'text',
  py: 'python',
  rs: 'rust',
  sh: 'bash',
  shell: 'bash',
  ts: 'typescript',
  yml: 'yaml',
  zsh: 'bash',
};

let highlighterPromise: ReturnType<typeof getSingletonHighlighter> | null = null;

export type SupportedCodeLanguage = (typeof SHIKI_LANGUAGES)[number] | 'text';

export const codeLanguageOptions = [
  'text',
  'javascript',
  'typescript',
  'tsx',
  'jsx',
  'json',
  'go',
  'cpp',
  'html',
  'css',
  'bash',
  'python',
  'rust',
  'java',
  'kotlin',
  'swift',
  'sql',
  'yaml',
  'toml',
  'markdown',
] as const satisfies ReadonlyArray<SupportedCodeLanguage>;

function countMatches(code: string, pattern: RegExp): number {
  return code.match(pattern)?.length ?? 0;
}

function looksLikeJson(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) {
    return false;
  }

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function detectCodeLanguageFromContent(code: string): SupportedCodeLanguage {
  const trimmed = code.trim();
  if (!trimmed) {
    return 'text';
  }

  if (looksLikeJson(trimmed)) {
    return 'json';
  }

  const lower = trimmed.toLowerCase();

  const hasRustSyntax =
    /\b(use\s+\w|fn\s+\w+\s*\(|impl\s+\w+|pub\s+(struct|enum|fn)|let\s+mut\s+\w+)/m.test(trimmed) ||
    /\blet\s+mut\s+\w+\s*:\s*[^=;]+=\s*/m.test(trimmed) ||
    /\b[A-Za-z_][\w]*::[A-Za-z_][\w:]*/m.test(trimmed);
  if (hasRustSyntax) {
    return 'rust';
  }

  const hasJsx =
    /<[A-Z][A-Za-z0-9]*(\s[^>]*)?>/.test(trimmed) ||
    /<>[\s\S]*<\/>/.test(trimmed) ||
    ((/\b(return|=>)\b/.test(trimmed) || /\bReact\.createElement\b/.test(trimmed)) &&
      (/<([A-Za-z][\w.-]*)(\s[^>]*)?>/.test(trimmed) ||
        /<([A-Za-z][\w.-]*)(\s[^>]*)?\/>/.test(trimmed)));
  const hasTypeScriptSyntax =
    /\b(interface|type)\s+\w+/m.test(trimmed) ||
    /\b(enum|implements|readonly)\b/m.test(trimmed) ||
    /:\s*[A-Za-z_$][\w<>{}|,&? ]*(?=\s*[=),;])/m.test(trimmed) ||
    /\bas\s+[A-Za-z_$][\w<>{}|,&? ]*/m.test(trimmed);

  if (hasJsx && hasTypeScriptSyntax) {
    return 'tsx';
  }

  if (hasJsx) {
    return 'jsx';
  }

  if (hasTypeScriptSyntax) {
    return 'typescript';
  }

  if (/^#!.*\b(bash|sh|zsh)\b/m.test(trimmed)) {
    return 'bash';
  }

  if (
    countMatches(trimmed, /^\s*export\s+[A-Za-z_][A-Za-z0-9_]*=/gm) >= 1 ||
    countMatches(trimmed, /^\s*(cd|ls|pwd|cat|grep|find|curl|wget|chmod|chown|sudo)\b/gm) >= 2
  ) {
    return 'bash';
  }

  if (/^\s*<\?xml\b/m.test(trimmed)) {
    return 'xml';
  }

  if (/<[a-z][\w-]*(\s[^>]*)?>/i.test(trimmed) && /<\/[a-z][\w-]*>/i.test(trimmed)) {
    return 'html';
  }

  if (/(^|\n)\s*[\w.#:[\]-]+\s*\{[^}]*:[^}]*\}/m.test(trimmed)) {
    return 'css';
  }

  if (
    /\b(select|insert\s+into|update|delete\s+from|create\s+table|alter\s+table|drop\s+table)\b/i.test(
      lower
    )
  ) {
    return 'sql';
  }

  if (/^\s*\[[^\]]+\]\s*$/m.test(trimmed) || /^\s*[\w.-]+\s*=\s*.+$/m.test(trimmed)) {
    return 'toml';
  }

  if (
    /^---\s*$/m.test(trimmed) ||
    (countMatches(trimmed, /^\s*[\w-]+\s*:\s*.+$/gm) >= 2 &&
      !/[;{}()]/.test(trimmed) &&
      !/\b(function|class|const|let|var)\b/.test(lower))
  ) {
    return 'yaml';
  }

  if (/^\s*package\s+main\b/m.test(trimmed) || /\bfunc\s+\w+\s*\([^)]*\)\s*\{/m.test(trimmed)) {
    return 'go';
  }

  if (
    /^\s*#include\s*[<"]/m.test(trimmed) ||
    /\bstd::\w+/m.test(trimmed) ||
    /\bint\s+main\s*\(/m.test(trimmed)
  ) {
    return 'cpp';
  }

  if (
    /^\s*import\s+\w+(\.\w+)*;?/m.test(trimmed) &&
    /\b(class|interface|enum)\s+\w+/m.test(trimmed) &&
    /\bpublic\s+static\s+void\s+main\s*\(/m.test(trimmed)
  ) {
    return 'java';
  }

  if (
    /\bfun\s+main\s*\(/m.test(trimmed) ||
    /\b(data\s+class|val\s+\w+|var\s+\w+)\b/m.test(trimmed)
  ) {
    return 'kotlin';
  }

  if (
    /^\s*import\s+(Foundation|UIKit|SwiftUI)\b/m.test(trimmed) ||
    /\b(func|struct|enum|protocol)\s+\w+\b/m.test(trimmed)
  ) {
    return 'swift';
  }

  if (
    /^\s*(from\s+\w+\s+import\s+|import\s+\w+)/m.test(trimmed) ||
    /^\s*(def|class)\s+\w+\s*\(?.*\)?:\s*$/m.test(trimmed)
  ) {
    return 'python';
  }

  const hasMarkdownFence = /^```[\w-]*\s*$/m.test(trimmed);
  const hasMarkdownHeading = /^\s{0,3}#{1,6}\s+\S+/m.test(trimmed);
  if (hasMarkdownFence || hasMarkdownHeading) {
    return 'markdown';
  }

  if (
    /\b(function|const|let|var|return|async|await|console\.log)\b/m.test(trimmed) ||
    /=>/.test(trimmed)
  ) {
    return 'javascript';
  }

  return 'text';
}

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = getSingletonHighlighter({
      langs: [...SHIKI_LANGUAGES],
      themes: [
        ...new Set([...SHIKI_LOADABLE_THEMES, ...Object.values(SHIKI_DEFAULT_THEMES)]),
      ] as BundledTheme[],
    }).catch((error) => {
      highlighterPromise = null;
      throw error;
    });
  }

  return highlighterPromise;
}

export function normalizeCodeLanguage(rawLanguage?: string | null): SupportedCodeLanguage {
  if (!rawLanguage) {
    return 'text';
  }

  const normalized = rawLanguage
    .trim()
    .toLowerCase()
    .replace(/^language-/, '')
    .replace(/^lang-/, '');

  const aliasResolved = LANGUAGE_ALIASES[normalized] ?? normalized;

  if (aliasResolved === 'text') {
    return 'text';
  }

  if (SHIKI_LANGUAGE_SET.has(aliasResolved as BundledLanguage)) {
    return aliasResolved as SupportedCodeLanguage;
  }

  return 'text';
}

export function normalizeReaderCodeTheme(rawTheme?: string | null): ReaderCodeTheme {
  if (!rawTheme) {
    return 'auto';
  }

  return READER_CODE_THEME_SET.has(rawTheme as ReaderCodeTheme)
    ? (rawTheme as ReaderCodeTheme)
    : 'auto';
}

function resolveShikiTheme(theme: ReaderCodeTheme, isDarkMode: boolean): BundledTheme {
  if (theme === 'auto') {
    return isDarkMode ? SHIKI_DEFAULT_THEMES.dark : SHIKI_DEFAULT_THEMES.light;
  }

  return theme;
}

export async function highlightCodeWithShiki({
  code,
  language,
  isDarkMode,
  theme = 'auto',
}: {
  code: string;
  language: SupportedCodeLanguage;
  isDarkMode: boolean;
  theme?: ReaderCodeTheme;
}): Promise<string | null> {
  if (!code.trim() || language === 'text') {
    return null;
  }

  const highlighter = await getHighlighter();

  return highlighter.codeToHtml(code, {
    lang: language,
    theme: resolveShikiTheme(theme, isDarkMode),
  });
}

export function formatCodeForLanguage(code: string, language: SupportedCodeLanguage): string {
  if (language !== 'json') {
    return code;
  }

  try {
    const parsed = JSON.parse(code);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return code;
  }
}
