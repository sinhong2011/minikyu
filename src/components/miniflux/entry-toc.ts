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

export function buildEntryContentWithToc(html: string): EntryContentWithToc {
  if (!html.trim()) {
    return { html, tocItems: [] };
  }

  if (typeof DOMParser === 'undefined') {
    return { html, tocItems: [] };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
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
