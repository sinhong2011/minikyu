import { Converter } from 'opencc-js';
import type { ChineseConversionMode, ChineseConversionRule, Entry } from '@/lib/tauri-bindings';

type ConverterFn = (text: string) => string;

const SKIP_TEXT_NODE_TAGS = new Set(['STYLE', 'SCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'NOSCRIPT']);

const converterCache = new Map<Exclude<ChineseConversionMode, 'off'>, ConverterFn>();

function getConverter(mode: ChineseConversionMode): ConverterFn | null {
  if (mode === 'off') {
    return null;
  }

  const cached = converterCache.get(mode);
  if (cached) {
    return cached;
  }

  let converter: ConverterFn;
  switch (mode) {
    case 's2tw':
      converter = Converter({ from: 'cn', to: 'tw' });
      break;
    case 's2hk':
      converter = Converter({ from: 'cn', to: 'hk' });
      break;
    case 't2s':
      converter = Converter({ from: 't', to: 'cn' });
      break;
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

export function convertChineseText(
  text: string,
  mode: ChineseConversionMode,
  rules: ChineseConversionRule[]
): string {
  const converter = getConverter(mode);
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

export function convertChineseHtml(
  html: string,
  mode: ChineseConversionMode,
  rules: ChineseConversionRule[]
): string {
  if (!html) return html;
  if (mode === 'off' && rules.length === 0) return html;
  if (typeof document === 'undefined') return html;

  const template = document.createElement('template');
  template.innerHTML = html;

  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      const textNode = node as Text;
      if (!shouldSkipTextNode(textNode) && textNode.data.trim().length > 0) {
        textNode.data = convertChineseText(textNode.data, mode, rules);
      }
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  };

  walk(template.content);
  return template.innerHTML;
}

export function convertEntryChinese(
  entry: Entry,
  mode: ChineseConversionMode,
  customRules: ChineseConversionRule[] | undefined
): Entry {
  const rules = normalizeCustomConversionRules(customRules);
  if (mode === 'off' && rules.length === 0) {
    return entry;
  }

  return {
    ...entry,
    title: convertChineseText(entry.title, mode, rules),
    content: entry.content ? convertChineseHtml(entry.content, mode, rules) : entry.content,
  };
}
