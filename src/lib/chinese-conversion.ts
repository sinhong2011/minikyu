import type { ChineseConversionMode, ChineseConversionRule, Entry } from '@/lib/tauri-bindings';

type ConverterFn = (text: string) => string;

const SKIP_TEXT_NODE_TAGS = new Set(['STYLE', 'SCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'NOSCRIPT']);

const converterCache = new Map<Exclude<ChineseConversionMode, 'off'>, ConverterFn>();

async function getConverter(mode: ChineseConversionMode): Promise<ConverterFn | null> {
  if (mode === 'off') {
    return null;
  }

  const cached = converterCache.get(mode);
  if (cached) {
    return cached;
  }

  let converter: ConverterFn;
  switch (mode) {
    case 's2tw': {
      const { Converter } = await import('@willh/opencc-js/cn2t');
      converter = Converter({ from: 'cn', to: 'tw' });
      break;
    }
    case 's2hk': {
      const { Converter } = await import('@willh/opencc-js/cn2t');
      converter = Converter({ from: 'cn', to: 'hk' });
      break;
    }
    case 't2s': {
      const { Converter } = await import('@willh/opencc-js/t2cn');
      converter = Converter({ from: 't', to: 'cn' });
      break;
    }
    default:
      return null;
  }

  converterCache.set(mode, converter);
  return converter;
}

export function normalizeCustomConversionRules(
  rules: ChineseConversionRule[] | undefined
): ChineseConversionRule[] {
  return (rules ?? []).map((rule) => ({
    from: rule.from.trim(),
    to: rule.to.trim(),
  }));
}

export function customConversionRulesFingerprint(
  rules: ChineseConversionRule[] | undefined
): string {
  return JSON.stringify(normalizeCustomConversionRules(rules));
}

function applyCustomRules(text: string, rules: ChineseConversionRule[]): string {
  let output = text;
  for (const rule of rules) {
    if (!rule.from) continue;
    output = output.replaceAll(rule.from, rule.to);
  }
  return output;
}

export async function convertChineseText(
  text: string,
  mode: ChineseConversionMode,
  rules: ChineseConversionRule[]
): Promise<string> {
  const converter = await getConverter(mode);
  const converted = converter ? converter(text) : text;
  return rules.length > 0 ? applyCustomRules(converted, rules) : converted;
}

function shouldSkipTextNode(textNode: Text): boolean {
  let parent: Node | null = textNode.parentNode;
  while (parent) {
    if (parent.nodeType === 1) {
      const tagName = (parent as Element).tagName;
      if (SKIP_TEXT_NODE_TAGS.has(tagName)) {
        return true;
      }
    }
    parent = parent.parentNode;
  }
  return false;
}

export async function convertChineseHtml(
  html: string,
  mode: ChineseConversionMode,
  rules: ChineseConversionRule[]
): Promise<string> {
  if (!html) return html;
  if (mode === 'off' && rules.length === 0) return html;
  if (typeof document === 'undefined') return html;

  // Content is already sanitized by DOMPurify upstream in SafeHtml
  const template = document.createElement('template');
  template.innerHTML = html; // SAFE: pre-sanitized HTML

  const walk = async (node: Node): Promise<void> => {
    if (node.nodeType === 3) {
      const textNode = node as Text;
      if (!shouldSkipTextNode(textNode) && textNode.data.trim().length > 0) {
        textNode.data = await convertChineseText(textNode.data, mode, rules);
      }
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      await walk(child);
    }
  };

  await walk(template.content);
  return template.innerHTML; // SAFE: pre-sanitized HTML
}

export async function convertEntryChinese(
  entry: Entry,
  mode: ChineseConversionMode,
  customRules: ChineseConversionRule[] | undefined
): Promise<Entry> {
  const rules = normalizeCustomConversionRules(customRules);
  if (mode === 'off' && rules.length === 0) {
    return entry;
  }

  return {
    ...entry,
    title: await convertChineseText(entry.title, mode, rules),
    content: entry.content ? await convertChineseHtml(entry.content, mode, rules) : entry.content,
  };
}
