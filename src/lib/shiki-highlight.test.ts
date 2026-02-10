import { describe, expect, it } from 'vitest';
import { detectCodeLanguageFromContent } from './shiki-highlight';

describe('shiki-highlight language detection', () => {
  it('detects json from valid object payload', () => {
    const code = `{"name":"get_weather","arguments":{"location":"beijing","unit":"celsius"}}`;
    expect(detectCodeLanguageFromContent(code)).toBe('json');
  });

  it('detects bash from export commands', () => {
    const code = `export ANTHROPIC_AUTH_TOKEN=xxx\nexport ANTHROPIC_BASE_URL=https://example.com`;
    expect(detectCodeLanguageFromContent(code)).toBe('bash');
  });

  it('detects sql from query keywords', () => {
    const code = 'SELECT id, title FROM entries WHERE id = 1;';
    expect(detectCodeLanguageFromContent(code)).toBe('sql');
  });

  it('detects yaml from key-value mappings', () => {
    const code = 'name: minikyu\nversion: 1\nfeatures:\n  - reader';
    expect(detectCodeLanguageFromContent(code)).toBe('yaml');
  });

  it('detects tsx from jsx + type syntax', () => {
    const code =
      'type Props = { title: string };\nexport function Card({ title }: Props) { return <div>{title}</div>; }';
    expect(detectCodeLanguageFromContent(code)).toBe('tsx');
  });

  it('detects rust let mut type annotation syntax', () => {
    const code = 'let mut tags: HashMap<String, Vec<&Post>> = HashMap::new();';
    expect(detectCodeLanguageFromContent(code)).toBe('rust');
  });

  it('keeps typescript detection for standard TS syntax', () => {
    const code = 'const tags: Record<string, Post[]> = {};';
    expect(detectCodeLanguageFromContent(code)).toBe('typescript');
  });

  it('falls back to text for plain content', () => {
    const code = 'this is plain notes without obvious language syntax';
    expect(detectCodeLanguageFromContent(code)).toBe('text');
  });
});
