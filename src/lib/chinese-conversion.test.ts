import { describe, expect, it } from 'vitest';
import type { Entry } from '@/lib/tauri-bindings';
import {
  convertChineseHtml,
  convertChineseText,
  convertEntryChinese,
  customConversionRulesFingerprint,
  normalizeCustomConversionRules,
} from './chinese-conversion';

describe('chinese-conversion', () => {
  it('converts plain text with selected mode', () => {
    const output = convertChineseText('汉语测试', 's2tw', []);
    expect(output).toBe('漢語測試');
  });

  it('preserves style block content while converting html text nodes', () => {
    const input = '<style>.title::before{content:"汉语"}</style><div class="title">汉语测试</div>';
    const output = convertChineseHtml(input, 's2tw', []);

    expect(output).toContain('<style>.title::before{content:"汉语"}</style>');
    expect(output).toContain('<div class="title">漢語測試</div>');
  });

  it('applies custom rules after conversion', () => {
    const output = convertChineseText('开放中文', 's2tw', [{ from: '開放', to: '开放' }]);
    expect(output).toBe('开放中文');
  });

  it('normalizes and fingerprints custom rules deterministically', () => {
    const normalized = normalizeCustomConversionRules([{ from: ' 開放 ', to: ' 开放 ' }]);
    expect(normalized).toEqual([{ from: '開放', to: '开放' }]);

    const first = customConversionRulesFingerprint(normalized);
    const second = customConversionRulesFingerprint([{ from: '開放', to: '开放' }]);
    expect(first).toBe(second);
  });

  it('returns original entry when conversion is off and no custom rules', () => {
    const entry = {
      title: '汉语',
      content: '<p>汉语</p>',
    } as unknown as Entry;

    const output = convertEntryChinese(entry, 'off', []);
    expect(output).toBe(entry);
  });
});
