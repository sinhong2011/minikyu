import { describe, expect, it } from 'vitest';
import { buildEntryContentWithToc } from './entry-toc';

describe('entry-toc', () => {
  it('extracts h2-h4 headings and adds ids', () => {
    const input = `
      <h1>Main title</h1>
      <h2>Introduction</h2>
      <p>Body</p>
      <h3>Details</h3>
      <h4>Appendix</h4>
    `;
    const output = buildEntryContentWithToc(input);

    expect(output.tocItems).toHaveLength(3);
    expect(output.tocItems[0]).toMatchObject({
      id: 'introduction',
      text: 'Introduction',
      preview: 'Body',
      sectionLength: 4,
      level: 2,
    });
    expect(output.tocItems[1]).toMatchObject({
      id: 'details',
      text: 'Details',
      sectionLength: 0,
      level: 3,
    });
    expect(output.tocItems[2]).toMatchObject({
      id: 'appendix',
      text: 'Appendix',
      sectionLength: 0,
      level: 4,
    });
    expect(output.html).toContain('id="introduction"');
    expect(output.html).toContain('data-reading-heading="true"');
  });

  it('keeps ids unique when headings repeat', () => {
    const input = `
      <h2>Overview</h2>
      <h2>Overview</h2>
      <h3 id="overview">Deep dive</h3>
    `;
    const output = buildEntryContentWithToc(input);

    expect(output.tocItems.map((item) => item.id)).toEqual([
      'overview',
      'overview-2',
      'overview-3',
    ]);
  });

  it('returns empty toc when html is empty', () => {
    const output = buildEntryContentWithToc('  ');
    expect(output.tocItems).toEqual([]);
  });

  it('generates section preview and strips script/style from section text', () => {
    const input = `
      <h2>Section A</h2>
      <p>First sentence.</p>
      <script>window.alert('xss')</script>
      <style>.example{display:none;}</style>
      <p>Second sentence with more context.</p>
      <h2>Section B</h2>
    `;

    const output = buildEntryContentWithToc(input);

    expect(output.tocItems[0]).toMatchObject({
      id: 'section-a',
      preview: 'First sentence. Second sentence with more context.',
      sectionLength: 50,
    });
  });
});
