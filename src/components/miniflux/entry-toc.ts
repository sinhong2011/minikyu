export interface EntryTocItem {
  id: string;
  text: string;
  preview: string;
  sectionLength: number;
  level: 2 | 3 | 4;
}

export interface EntryContentWithToc {
  html: string;
  tocItems: EntryTocItem[];
}

const TOC_HEADING_SELECTOR = 'h2, h3, h4';
const BLOCK_LEVEL_SELECTOR =
  'p, div, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, table, section, article, figure, hr';

function toSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toUniqueId(baseId: string, usedIds: Set<string>): string {
  let id = baseId;
  let counter = 1;

  while (usedIds.has(id)) {
    counter += 1;
    id = `${baseId}-${counter}`;
  }

  usedIds.add(id);
  return id;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractSectionText(
  documentNode: Document,
  headingNode: HTMLElement,
  nextHeadingNode?: HTMLElement
): string {
  const range = documentNode.createRange();
  range.setStartAfter(headingNode);

  if (nextHeadingNode) {
    range.setEndBefore(nextHeadingNode);
  } else if (documentNode.body.lastChild) {
    range.setEndAfter(documentNode.body.lastChild);
  } else {
    return '';
  }

  const fragment = range.cloneContents();
  const fragmentContainer = documentNode.createElement('div');
  fragmentContainer.appendChild(fragment);

  for (const removableNode of fragmentContainer.querySelectorAll('script, style, noscript')) {
    removableNode.remove();
  }

  return normalizeWhitespace(fragmentContainer.textContent ?? '');
}

function toPreview(text: string): string {
  const normalizedText = normalizeWhitespace(text);
  const maxLength = 110;

  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, maxLength).trimEnd()}…`;
}

function wrapBareTextInParagraphs(doc: Document): void {
  if (doc.body.querySelector(BLOCK_LEVEL_SELECTOR)) {
    return;
  }

  const rawText = doc.body.textContent ?? '';
  if (!rawText.trim()) {
    return;
  }

  let chunks = rawText
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  // If splitting on double newlines yields only one block, try single newlines
  if (chunks.length <= 1) {
    const singleSplit = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (singleSplit.length > 1) {
      chunks = singleSplit;
    }
  }

  if (chunks.length === 0) {
    return;
  }

  // Build paragraphs safely using DOM APIs to avoid XSS from raw text
  while (doc.body.firstChild) {
    doc.body.removeChild(doc.body.firstChild);
  }
  for (const text of chunks) {
    const p = doc.createElement('p');
    p.textContent = text;
    doc.body.appendChild(p);
  }
}

export function buildEntryContentWithToc(html: string): EntryContentWithToc {
  if (!html.trim()) {
    return { html, tocItems: [] };
  }

  if (typeof DOMParser === 'undefined') {
    return { html, tocItems: [] };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  wrapBareTextInParagraphs(doc);
  const headingNodes = Array.from(doc.body.querySelectorAll<HTMLElement>(TOC_HEADING_SELECTOR));
  const usedIds = new Set<string>();
  const tocItems: EntryTocItem[] = [];

  for (const [index, headingNode] of headingNodes.entries()) {
    const text = headingNode.textContent?.trim() ?? '';
    if (!text) {
      continue;
    }
    const nextHeadingNode = headingNodes[index + 1];
    const sectionText = extractSectionText(doc, headingNode, nextHeadingNode);
    const sectionLength = sectionText.length;
    const preview = toPreview(sectionText);

    const existingId = headingNode.id.trim();
    const baseId = existingId || toSlug(text) || `section-${index + 1}`;
    const uniqueId = toUniqueId(baseId, usedIds);
    headingNode.id = uniqueId;
    headingNode.setAttribute('data-reading-heading', 'true');

    const level = Number.parseInt(headingNode.tagName.replace('H', ''), 10);
    if (level === 2 || level === 3 || level === 4) {
      tocItems.push({
        id: uniqueId,
        text,
        preview,
        sectionLength,
        level,
      });
    }
  }

  return {
    html: doc.body.innerHTML,
    tocItems,
  };
}
