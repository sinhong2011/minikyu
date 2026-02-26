import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SafeHtml } from './SafeHtml';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});

vi.mock('dompurify', () => ({
  default: {
    sanitize: (value: string) => value,
  },
}));

vi.mock('./ImageViewer', () => ({
  // biome-ignore lint/style/useNamingConvention: mock key must match named export
  ImageViewer: () => null,
}));

i18n.load('en', {});
i18n.activate('en');

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

const renderSafeHtml = (ui: React.ReactElement) => render(ui, { wrapper: TestWrapper });

describe('SafeHtml reader node blocks', () => {
  it('wraps block-level nodes with reader metadata for UI controls', () => {
    const html = `
      <h2 id="intro" data-reading-heading="true">Introduction</h2>
      <p>First paragraph for translation.</p>
      <blockquote>Important quote.</blockquote>
      <ul><li>One</li><li>Two</li></ul>
    `;
    const { container } = renderSafeHtml(<SafeHtml html={html} />);

    const readerNodes = Array.from(
      container.querySelectorAll<HTMLElement>('[data-reader-node="true"]')
    );

    expect(readerNodes).toHaveLength(3);
    expect(readerNodes.map((node) => node.getAttribute('data-reader-node-tag'))).toEqual([
      'h2',
      'p',
      'ul',
    ]);
    expect(readerNodes.map((node) => node.getAttribute('data-reader-node-index'))).toEqual([
      '0',
      '1',
      '2',
    ]);
    expect(
      readerNodes.every((node) => Number(node.getAttribute('data-reader-node-text-length')) > 0)
    ).toBe(true);
    expect(
      readerNodes.every((node) => (node.getAttribute('class') ?? '').includes('rounded-xl'))
    ).toBe(true);
    expect(
      readerNodes.every(
        (node) =>
          node.querySelector('[data-reader-node-menu-trigger="true"]') instanceof HTMLElement
      )
    ).toBe(true);
    expect(container.querySelector('h2#intro[data-reading-heading="true"]')).toBeInTheDocument();
  });

  it('keeps inline elements inside the same reader block', () => {
    const html =
      '<p>Hello <a href="https://example.com">world</a> and <strong>friends</strong>.</p>';
    const { container } = renderSafeHtml(<SafeHtml html={html} />);

    const readerNodes = container.querySelectorAll<HTMLElement>('[data-reader-node="true"]');
    expect(readerNodes).toHaveLength(1);
    expect(readerNodes[0]?.getAttribute('data-reader-node-tag')).toBe('p');
    expect(readerNodes[0]?.querySelector('a')).toBeInTheDocument();
    expect(readerNodes[0]?.querySelector('strong')).toBeInTheDocument();
  });

  describe('onTranslateNode', () => {
    it('calls onTranslateNode with paragraph text when Translate menu item is clicked', async () => {
      const onTranslateNode = vi.fn();
      const { container } = renderSafeHtml(
        <SafeHtml
          html="<p>Hello world, this is a test paragraph for translation.</p>"
          onTranslateNode={onTranslateNode}
        />
      );

      // Click the ⋮ menu trigger on the first reader node
      const menuTrigger = container.querySelector<HTMLElement>(
        '[data-reader-node-menu-trigger="true"]'
      );
      expect(menuTrigger).toBeInTheDocument();
      // biome-ignore lint/style/noNonNullAssertion: test assertion above ensures non-null
      fireEvent.click(menuTrigger!);

      // Find and click the Translate menu item
      const translateItem = await screen.findByText('Translate this paragraph');
      fireEvent.click(translateItem);

      expect(onTranslateNode).toHaveBeenCalledWith(
        'Hello world, this is a test paragraph for translation.'
      );
    });

    it('shows disabled hint when onTranslateNode is not provided', () => {
      const { container } = renderSafeHtml(
        <SafeHtml html="<p>Hello world, this is a test paragraph.</p>" />
      );

      const menuTrigger = container.querySelector<HTMLElement>(
        '[data-reader-node-menu-trigger="true"]'
      );
      // biome-ignore lint/style/noNonNullAssertion: querySelector result checked by context
      fireEvent.click(menuTrigger!);

      expect(screen.queryByText('Translate this paragraph')).not.toBeInTheDocument();
      expect(screen.getByText('Translation controls in top bar')).toBeInTheDocument();
    });
  });

  it('does not apply hover-card menu controls to table nodes', () => {
    const html = `
      <table>
        <thead>
          <tr><th>Name</th><th>Value</th></tr>
        </thead>
        <tbody>
          <tr><td>One</td><td>1</td></tr>
        </tbody>
      </table>
    `;
    const { container } = renderSafeHtml(<SafeHtml html={html} />);

    const tableNode = container.querySelector<HTMLElement>('[data-reader-node-tag="table"]');
    expect(tableNode).toBeInTheDocument();
    expect(tableNode?.querySelector('[data-reader-node-menu-trigger="true"]')).toBeNull();
    expect((tableNode?.getAttribute('class') ?? '').includes('group/reader-node')).toBe(false);
  });

  it('renders ParticleColumn canvas when paragraph has data-translation-loading', () => {
    render(
      <TestWrapper>
        <SafeHtml html='<p data-translation-loading="true">Translating paragraph</p>' />
      </TestWrapper>
    );
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('does not render ParticleColumn canvas for normal paragraphs', () => {
    render(
      <TestWrapper>
        <SafeHtml html="<p>Normal paragraph</p>" />
      </TestWrapper>
    );
    expect(document.querySelector('canvas')).not.toBeInTheDocument();
  });
});
