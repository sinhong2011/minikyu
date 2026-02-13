import { CheckmarkCircle01Icon, CopyIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import DOMPurify from 'dompurify';
import parse, {
  attributesToProps,
  domToReact,
  Element,
  type HTMLReactParserOptions,
} from 'html-react-parser';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useClipboard } from '@/hooks/use-clipboard';
import { convertChineseHtml, normalizeCustomConversionRules } from '@/lib/chinese-conversion';
import {
  codeLanguageOptions,
  detectCodeLanguageFromContent,
  formatCodeForLanguage,
  highlightCodeWithShiki,
  normalizeCodeLanguage,
  type ReaderCodeTheme,
  type SupportedCodeLanguage,
} from '@/lib/shiki-highlight';
import type { ChineseConversionMode, ChineseConversionRule } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { ImageViewer } from './ImageViewer';

interface Image {
  src: string;
  alt?: string;
}

interface SafeHtmlProps {
  html: string;
  bionicEnglish?: boolean;
  chineseConversionMode?: ChineseConversionMode;
  customConversionRules?: ChineseConversionRule[];
  codeTheme?: ReaderCodeTheme;
  className?: string;
  style?: React.CSSProperties;
}

interface TransitionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const SHARED_IMAGE_ANIMATION_DURATION_MS = 280;
const SHARED_IMAGE_ANIMATION_EASING = 'cubic-bezier(0.2, 0.72, 0.18, 1)';
const VIEWER_CLOSE_ANIMATION_DURATION_MS = 360;
const VIEWER_CLOSE_ANIMATION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

function toTransitionRect(rect: DOMRect): TransitionRect {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function getVisibleArea(rect: DOMRect): number {
  const visibleWidth = Math.max(
    0,
    Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
  );
  const visibleHeight = Math.max(
    0,
    Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
  );
  return visibleWidth * visibleHeight;
}

function CodeBlock({
  text,
  copyLabel,
  languageLabel,
  defaultLanguage,
  codeTheme,
}: {
  text: string;
  copyLabel: string;
  languageLabel: string;
  defaultLanguage: SupportedCodeLanguage;
  codeTheme: ReaderCodeTheme;
}) {
  const { copy, copied } = useClipboard();
  const codeLanguageId = useId();
  const [language, setLanguage] = useState<SupportedCodeLanguage>(defaultLanguage);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [isHighlighting, setIsHighlighting] = useState(false);

  useEffect(() => {
    setLanguage(defaultLanguage);
  }, [defaultLanguage]);

  const displayText = useMemo(() => formatCodeForLanguage(text, language), [text, language]);
  const plainLines = useMemo(() => {
    const normalized = displayText.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    return lines.length > 0 ? lines : [''];
  }, [displayText]);

  useEffect(() => {
    let cancelled = false;

    const runHighlight = async () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      setIsHighlighting(true);

      try {
        const html = await highlightCodeWithShiki({
          code: displayText,
          language,
          isDarkMode,
          theme: codeTheme,
        });

        if (!cancelled) {
          setHighlightedHtml(html);
        }
      } catch {
        if (!cancelled) {
          setHighlightedHtml(null);
        }
      } finally {
        if (!cancelled) {
          setIsHighlighting(false);
        }
      }
    };

    void runHighlight();

    return () => {
      cancelled = true;
    };
  }, [codeTheme, displayText, language]);

  return (
    <div className="group relative my-6 first:mt-0 last:mb-0">
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <label className="sr-only" htmlFor={codeLanguageId}>
          {languageLabel}
        </label>
        <select
          id={codeLanguageId}
          value={language}
          onChange={(event) => setLanguage(normalizeCodeLanguage(event.target.value))}
          aria-label={languageLabel}
          className="h-8 rounded-md border border-border/60 bg-background/90 px-2 text-xs text-foreground backdrop-blur-sm"
        >
          {codeLanguageOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 border-border/50 bg-background/80 backdrop-blur-sm hover:bg-background"
          onClick={() => copy(displayText)}
          title={copyLabel}
          aria-label={copyLabel}
        >
          <HugeiconsIcon
            icon={copied ? CheckmarkCircle01Icon : CopyIcon}
            className={cn('h-4 w-4', copied && 'text-green-500')}
          />
        </Button>
      </div>

      <div
        className={cn(
          'overflow-x-auto rounded-xl border border-border/40 bg-muted/30 text-sm [--code-line-height:1.625rem]',
          '[&_.shiki]:relative [&_.shiki]:m-0 [&_.shiki]:bg-transparent! [&_.shiki]:p-4 [&_.shiki]:pt-12',
          '[&_.shiki]:[counter-reset:line] [&_.shiki]:[line-height:var(--code-line-height)]',
          "[&_.shiki]:before:pointer-events-none [&_.shiki]:before:absolute [&_.shiki]:before:inset-y-0 [&_.shiki]:before:left-0 [&_.shiki]:before:w-11 [&_.shiki]:before:bg-muted/50 [&_.shiki]:before:content-['']",
          "[&_.shiki]:after:pointer-events-none [&_.shiki]:after:absolute [&_.shiki]:after:inset-y-0 [&_.shiki]:after:left-11 [&_.shiki]:after:w-px [&_.shiki]:after:bg-border/50 [&_.shiki]:after:content-['']",
          '[&_code]:relative [&_code]:z-[1] [&_code]:font-mono [&_code]:text-sm [&_code]:whitespace-normal [&_code]:[line-height:var(--code-line-height)]',
          '[&_.line]:relative [&_.line]:block [&_.line]:min-h-[var(--code-line-height)] [&_.line]:pl-14 [&_.line]:pr-4 [&_.line]:whitespace-pre [&_.line]:[line-height:var(--code-line-height)]',
          '[&_.line]:before:absolute [&_.line]:before:top-0 [&_.line]:before:left-0 [&_.line]:before:w-10 [&_.line]:before:pr-6 [&_.line]:before:text-right [&_.line]:before:font-mono [&_.line]:before:tabular-nums [&_.line]:before:text-muted-foreground/70 [&_.line]:before:content-[counter(line)] [&_.line]:before:[counter-increment:line]'
        )}
      >
        {highlightedHtml ? (
          <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <pre className="shiki bg-transparent! p-4 pt-12">
            <code>
              {plainLines.map((line, index) => (
                <span key={`line-${index + 1}`} className="line">
                  {line.length > 0 ? line : ' '}
                </span>
              ))}
            </code>
          </pre>
        )}
      </div>

      {isHighlighting && (
        <div className="pointer-events-none absolute inset-0 rounded-xl border border-primary/20" />
      )}
    </div>
  );
}

function getTextContent(node: any): string {
  if (node.type === 'text') return node.data;
  if (node.children) return node.children.map(getTextContent).join('');
  return '';
}

function getTextContentWithLineBreaks(node: any): string {
  if (node.type === 'text') {
    return node.data;
  }

  if (!(node instanceof Element)) {
    if (node.children) {
      return node.children.map(getTextContentWithLineBreaks).join('');
    }
    return '';
  }

  if (node.name === 'br') {
    return '\n';
  }

  const isBlockNode = ['div', 'p', 'li', 'tr', 'section', 'article'].includes(node.name);
  const text = node.children.map(getTextContentWithLineBreaks).join('');

  if (!isBlockNode) {
    return text;
  }

  return `${text}\n`;
}

function getClassTokens(element: Element): string[] {
  const className = element.attribs.class ?? element.attribs.className ?? '';
  return className.split(/\s+/).filter(Boolean);
}

function extractCodeTextFromCell(cell: Element): string {
  const codeOrPre =
    findFirstDescendant(cell, (element) => element.name === 'code') ??
    findFirstDescendant(cell, (element) => element.name === 'pre') ??
    cell;

  const lineElements = codeOrPre.children.filter(
    (child): child is Element => child instanceof Element && getClassTokens(child).includes('line')
  );

  if (lineElements.length > 0) {
    return lineElements.map((lineElement) => getTextContent(lineElement)).join('\n');
  }

  return getTextContentWithLineBreaks(codeOrPre).replace(/\n+$/g, '');
}

function findFirstDescendant(
  node: Element,
  matcher: (element: Element) => boolean
): Element | null {
  for (const child of node.children) {
    if (!(child instanceof Element)) {
      continue;
    }

    if (matcher(child)) {
      return child;
    }

    const nested = findFirstDescendant(child, matcher);
    if (nested) {
      return nested;
    }
  }

  return null;
}

const CODE_TABLE_MARKERS = ['highlighttable', 'rouge-table', 'hljs-ln-table', 'codehilitetable'];
const CODE_CELL_MARKERS = ['code', 'rouge-code', 'hljs-ln-code', 'highlight-code'];
const GUTTER_CELL_MARKERS = ['gutter', 'rouge-gutter', 'hljs-ln-numbers', 'line-numbers'];

function hasAnyMarker(tokens: string[], markers: string[]): boolean {
  return tokens.some((token) => markers.includes(token));
}

function collectDescendantsByName(node: Element, tagName: string): Element[] {
  const elements: Element[] = [];

  for (const child of node.children) {
    if (!(child instanceof Element)) {
      continue;
    }

    if (child.name === tagName) {
      elements.push(child);
    }

    elements.push(...collectDescendantsByName(child, tagName));
  }

  return elements;
}

function extractCodeBlockFromTable(
  tableNode: Element
): { codeText: string; defaultLanguage: SupportedCodeLanguage } | null {
  const tableClassTokens = getClassTokens(tableNode);
  const tdNodes = collectDescendantsByName(tableNode, 'td');
  const hasPreOrCodeInTable = tdNodes.some(
    (tdNode) =>
      findFirstDescendant(
        tdNode,
        (element) => element.name === 'pre' || element.name === 'code'
      ) !== null
  );

  if (!hasPreOrCodeInTable) {
    return null;
  }

  const rows = collectDescendantsByName(tableNode, 'tr');
  if (!rows.length) {
    return null;
  }

  const numericFirstColumnRows = rows.filter((row) => {
    const cells = row.children.filter(
      (child): child is Element => child instanceof Element && child.name === 'td'
    );
    const firstCell = cells[0];
    const secondCell = cells[1];

    if (!firstCell || !secondCell) {
      return false;
    }

    const firstText = getTextContent(firstCell).trim();
    const secondText = getTextContent(secondCell).trim();

    return /^\d+$/.test(firstText) && secondText.length > 0;
  }).length;

  const hasCodeTableStructureByMarker =
    hasAnyMarker(tableClassTokens, CODE_TABLE_MARKERS) ||
    tdNodes.some((tdNode) => hasAnyMarker(getClassTokens(tdNode), CODE_CELL_MARKERS)) ||
    tdNodes.some((tdNode) => hasAnyMarker(getClassTokens(tdNode), GUTTER_CELL_MARKERS));
  const hasCodeTableStructureByLayout = numericFirstColumnRows > 0;
  const hasCodeTableStructure = hasCodeTableStructureByMarker || hasCodeTableStructureByLayout;

  if (!hasCodeTableStructure) {
    return null;
  }

  const lines: string[] = [];
  let language: SupportedCodeLanguage = 'text';

  for (const row of rows) {
    const cells = row.children.filter(
      (child): child is Element => child instanceof Element && child.name === 'td'
    );

    if (!cells.length) {
      continue;
    }

    const codeCellByMarker = cells.find((cell) =>
      hasAnyMarker(getClassTokens(cell), CODE_CELL_MARKERS)
    );
    const gutterCellIndex = cells.findIndex((cell) =>
      hasAnyMarker(getClassTokens(cell), GUTTER_CELL_MARKERS)
    );
    const numericFirstCellIndex =
      cells.length >= 2 && /^\d+$/.test(getTextContent(cells[0] ?? '').trim()) ? 0 : -1;

    const codeCellByPre = cells
      .map((cell) => ({
        cell,
        text: getTextContent(cell).trim(),
        hasPreOrCode:
          findFirstDescendant(
            cell,
            (element) => element.name === 'pre' || element.name === 'code'
          ) !== null,
      }))
      .filter((candidate) => candidate.hasPreOrCode && !/^\d+$/.test(candidate.text))
      .sort((a, b) => b.text.length - a.text.length)[0]?.cell;

    const codeCell =
      codeCellByMarker ??
      (gutterCellIndex >= 0 ? cells[gutterCellIndex + 1] : null) ??
      (numericFirstCellIndex >= 0 ? cells[numericFirstCellIndex + 1] : null) ??
      codeCellByPre;
    const fallbackCell = cells[cells.length - 1];
    const targetCell = codeCell ?? fallbackCell;

    if (!targetCell) {
      continue;
    }

    if (language === 'text') {
      const fromCell = detectCodeLanguageFromClassTokens(getClassTokens(targetCell));
      if (fromCell !== 'text') {
        language = fromCell;
      }
    }

    const rowText = extractCodeTextFromCell(targetCell).replace(/\r\n/g, '\n');
    const rowLines = rowText.split('\n');
    for (const rowLine of rowLines) {
      lines.push(rowLine);
    }
  }

  while (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (!lines.length) {
    return null;
  }

  if (language === 'text') {
    const tableLanguage = detectCodeLanguageFromClassTokens(tableClassTokens);
    if (tableLanguage !== 'text') {
      language = tableLanguage;
    }
  }

  if (language === 'text') {
    language = detectCodeLanguageFromContent(lines.join('\n'));
  }

  return {
    codeText: lines.join('\n'),
    defaultLanguage: language,
  };
}

function detectCodeLanguageFromClassTokens(tokens: string[]): SupportedCodeLanguage {
  for (const token of tokens) {
    const normalized = normalizeCodeLanguage(token);
    if (normalized !== 'text') {
      return normalized;
    }
  }

  return 'text';
}

function detectCodeLanguageFromPre(node: Element): SupportedCodeLanguage {
  const preClassLanguage = detectCodeLanguageFromClassTokens(getClassTokens(node));
  if (preClassLanguage !== 'text') {
    return preClassLanguage;
  }

  for (const child of node.children) {
    if (child instanceof Element && child.name === 'code') {
      const codeClassLanguage = detectCodeLanguageFromClassTokens(getClassTokens(child));
      if (codeClassLanguage !== 'text') {
        return codeClassLanguage;
      }
    }
  }

  return detectCodeLanguageFromContent(getTextContent(node));
}

const BIONIC_WORD_REGEX = /[A-Za-z][A-Za-z'’-]*/g;
const BIONIC_SKIP_SELECTOR = 'pre, code, kbd, samp, script, style, textarea, svg, math, strong, b';

function getBionicPrefixLength(wordLength: number): number {
  if (wordLength <= 3) return 1;
  if (wordLength <= 6) return 2;
  if (wordLength <= 10) return 3;
  return 4;
}

function buildBionicFragment(doc: Document, text: string): DocumentFragment | null {
  const fragment = doc.createDocumentFragment();
  let lastIndex = 0;
  let replaced = false;

  for (const match of text.matchAll(BIONIC_WORD_REGEX)) {
    const word = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex, index)));
    }

    const prefixLength = getBionicPrefixLength(word.length);

    if (prefixLength >= word.length) {
      fragment.appendChild(doc.createTextNode(word));
    } else {
      const strong = doc.createElement('strong');
      strong.textContent = word.slice(0, prefixLength);
      fragment.appendChild(strong);
      fragment.appendChild(doc.createTextNode(word.slice(prefixLength)));
    }

    lastIndex = index + word.length;
    replaced = true;
  }

  if (!replaced) {
    return null;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
}

function applyBionicReadingToHtml(html: string): string {
  if (typeof window === 'undefined') {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const parent = textNode.parentElement;
    if (!parent || parent.closest(BIONIC_SKIP_SELECTOR)) {
      continue;
    }

    const value = textNode.nodeValue ?? '';
    if (!/[A-Za-z]/.test(value)) {
      continue;
    }

    const fragment = buildBionicFragment(doc, value);
    if (!fragment) {
      continue;
    }

    parent.replaceChild(fragment, textNode);
  }

  return doc.body.innerHTML;
}

export function SafeHtml({
  html,
  bionicEnglish = false,
  chineseConversionMode = 'off',
  customConversionRules = [],
  codeTheme = 'auto',
  className,
  style,
}: SafeHtmlProps) {
  const { _ } = useLingui();
  const [viewerImages, setViewerImages] = useState<Image[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerCurrentIndex, setViewerCurrentIndex] = useState(0);
  const [showViewer, setShowViewer] = useState(false);
  const transitionImageRef = useRef<HTMLImageElement | null>(null);
  const transitionAnimationRef = useRef<Animation | null>(null);
  const openViewerTransitionFrameRef = useRef<number | null>(null);
  const viewerCloseAnimationRef = useRef<Animation | null>(null);
  const isViewerClosingRef = useRef(false);
  const clearViewerStateTimerRef = useRef<number | null>(null);
  const copyCodeLabel = _(msg`Copy code`);
  const codeLanguageLabel = _(msg`Language`);
  const imageFallbackAlt = _(msg`Image`);

  const clearSharedImageTransition = useCallback(() => {
    const animation = transitionAnimationRef.current;
    transitionAnimationRef.current = null;
    if (animation) {
      animation.onfinish = null;
      animation.oncancel = null;
      if (animation.playState === 'running') {
        animation.cancel();
      }
    }

    if (transitionImageRef.current) {
      transitionImageRef.current.remove();
      transitionImageRef.current = null;
    }
  }, []);

  const clearViewerCloseTransition = useCallback(() => {
    const animation = viewerCloseAnimationRef.current;
    viewerCloseAnimationRef.current = null;
    if (animation) {
      animation.onfinish = null;
      animation.oncancel = null;
      if (animation.playState === 'running') {
        animation.cancel();
      }
    }
    isViewerClosingRef.current = false;
  }, []);

  const clearViewerStateTimer = useCallback(() => {
    if (clearViewerStateTimerRef.current !== null) {
      window.clearTimeout(clearViewerStateTimerRef.current);
      clearViewerStateTimerRef.current = null;
    }
  }, []);

  const clearOpenViewerTransitionFrame = useCallback(() => {
    if (openViewerTransitionFrameRef.current !== null) {
      window.cancelAnimationFrame(openViewerTransitionFrameRef.current);
      openViewerTransitionFrameRef.current = null;
    }
  }, []);

  const getReaderImages = useCallback(
    () =>
      Array.from(document.querySelectorAll('.safe-html-content img')).filter(
        (element): element is HTMLImageElement => element instanceof HTMLImageElement
      ),
    []
  );

  const getSourceImageBySrc = useCallback(
    (src: string) => {
      const matches = getReaderImages().filter((image) => image.src === src);
      if (!matches.length) {
        return null;
      }

      return (
        matches
          .map((image) => ({ image, visibleArea: getVisibleArea(image.getBoundingClientRect()) }))
          .sort((a, b) => b.visibleArea - a.visibleArea)[0]?.image ?? matches[0]
      );
    },
    [getReaderImages]
  );

  const getCurrentViewerImage = useCallback(() => {
    const viewerImageElements = Array.from(document.querySelectorAll('.yarl__slide_image')).filter(
      (element): element is HTMLImageElement => element instanceof HTMLImageElement
    );

    if (!viewerImageElements.length) {
      return null;
    }

    return (
      viewerImageElements
        .map((image) => ({ image, visibleArea: getVisibleArea(image.getBoundingClientRect()) }))
        .sort((a, b) => b.visibleArea - a.visibleArea)[0]?.image ?? viewerImageElements[0]
    );
  }, []);

  const getViewerPortalElement = useCallback((): HTMLElement | null => {
    const openPortal =
      document.querySelector<HTMLElement>('.yarl__portal_open') ??
      document.querySelector<HTMLElement>('.yarl__portal');
    return openPortal ?? null;
  }, []);

  const computeViewerTargetRect = useCallback((image: HTMLImageElement): TransitionRect => {
    const imageWidth = image.naturalWidth || image.clientWidth || 1;
    const imageHeight = image.naturalHeight || image.clientHeight || 1;
    const ratio = imageWidth / Math.max(imageHeight, 1);

    const horizontalPadding = Math.max(24, Math.round(window.innerWidth * 0.08));
    const verticalPadding = Math.max(36, Math.round(window.innerHeight * 0.1));

    const maxWidth = Math.max(1, window.innerWidth - horizontalPadding * 2);
    const maxHeight = Math.max(1, window.innerHeight - verticalPadding * 2);

    let targetWidth = maxWidth;
    let targetHeight = targetWidth / ratio;

    if (targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = targetHeight * ratio;
    }

    return {
      left: (window.innerWidth - targetWidth) / 2,
      top: (window.innerHeight - targetHeight) / 2,
      width: targetWidth,
      height: targetHeight,
    };
  }, []);

  const runSharedImageTransition = useCallback(
    ({
      src,
      fromRect,
      toRect,
      onComplete,
    }: {
      src: string;
      fromRect: TransitionRect;
      toRect: TransitionRect;
      onComplete?: () => void;
    }) => {
      if (typeof window === 'undefined') {
        return;
      }

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      clearSharedImageTransition();

      const floatingImage = document.createElement('img');
      floatingImage.src = src;
      floatingImage.alt = '';
      floatingImage.decoding = 'async';
      floatingImage.loading = 'eager';
      floatingImage.style.position = 'fixed';
      floatingImage.style.left = `${fromRect.left}px`;
      floatingImage.style.top = `${fromRect.top}px`;
      floatingImage.style.width = `${fromRect.width}px`;
      floatingImage.style.height = `${fromRect.height}px`;
      floatingImage.style.borderRadius = '16px';
      floatingImage.style.objectFit = 'contain';
      floatingImage.style.pointerEvents = 'none';
      floatingImage.style.zIndex = '12000';
      floatingImage.style.boxShadow = '0 22px 54px rgba(0, 0, 0, 0.35)';
      floatingImage.style.willChange = 'left, top, width, height, opacity';

      document.body.appendChild(floatingImage);
      transitionImageRef.current = floatingImage;

      const animation = floatingImage.animate(
        [
          {
            left: `${fromRect.left}px`,
            top: `${fromRect.top}px`,
            width: `${fromRect.width}px`,
            height: `${fromRect.height}px`,
            opacity: 1,
          },
          {
            left: `${toRect.left}px`,
            top: `${toRect.top}px`,
            width: `${toRect.width}px`,
            height: `${toRect.height}px`,
            opacity: 1,
          },
        ],
        {
          duration: SHARED_IMAGE_ANIMATION_DURATION_MS,
          easing: SHARED_IMAGE_ANIMATION_EASING,
          fill: 'forwards',
        }
      );

      transitionAnimationRef.current = animation;
      let completed = false;
      const finish = () => {
        if (completed) {
          return;
        }
        completed = true;
        clearSharedImageTransition();
        onComplete?.();
      };
      animation.onfinish = finish;
      animation.oncancel = finish;
    },
    [clearSharedImageTransition]
  );

  const openImageViewer = useCallback(
    (src: string, triggerImageElement?: HTMLImageElement | null) => {
      const resolvedSrc = triggerImageElement?.src ?? src;
      const imgElements = getReaderImages();
      const sourceImage = triggerImageElement ?? getSourceImageBySrc(resolvedSrc);
      const sourceRect = sourceImage ? toTransitionRect(sourceImage.getBoundingClientRect()) : null;

      const images: Image[] = imgElements.map((img) => ({
        src: img.src,
        alt: img.alt,
      }));

      const clickedIndex = imgElements.findIndex((img) => img.src === resolvedSrc);
      const nextIndex = clickedIndex >= 0 ? clickedIndex : 0;

      clearViewerStateTimer();
      clearOpenViewerTransitionFrame();
      clearSharedImageTransition();
      setViewerImages(images);
      setViewerIndex(nextIndex);
      setViewerCurrentIndex(nextIndex);
      setShowViewer(true);

      if (!sourceRect) {
        return;
      }

      let attempts = 0;
      const maxAttempts = 24;
      const runOpenTransition = () => {
        const viewerImage = getCurrentViewerImage();
        const hasMatchingViewerImage = viewerImage?.src === resolvedSrc;

        if (!hasMatchingViewerImage && attempts < maxAttempts) {
          attempts += 1;
          openViewerTransitionFrameRef.current = window.requestAnimationFrame(runOpenTransition);
          return;
        }

        openViewerTransitionFrameRef.current = null;

        const targetRect = hasMatchingViewerImage
          ? toTransitionRect(viewerImage.getBoundingClientRect())
          : sourceImage
            ? computeViewerTargetRect(sourceImage)
            : null;
        if (!targetRect) {
          return;
        }

        if (viewerImage) {
          viewerImage.style.opacity = '0';
        }

        runSharedImageTransition({
          src: resolvedSrc,
          fromRect: sourceRect,
          toRect: targetRect,
          onComplete: () => {
            if (viewerImage) {
              viewerImage.style.opacity = '';
            }
          },
        });
      };

      openViewerTransitionFrameRef.current = window.requestAnimationFrame(runOpenTransition);
    },
    [
      clearViewerStateTimer,
      clearOpenViewerTransitionFrame,
      clearSharedImageTransition,
      computeViewerTargetRect,
      getCurrentViewerImage,
      getReaderImages,
      getSourceImageBySrc,
      runSharedImageTransition,
    ]
  );

  const closeImageViewer = useCallback(() => {
    if (isViewerClosingRef.current) {
      return;
    }

    clearOpenViewerTransitionFrame();
    const portal = getViewerPortalElement();
    const currentSlide = viewerImages[viewerCurrentIndex] ?? null;
    const currentSrc = currentSlide?.src;
    const currentViewerImage = getCurrentViewerImage();
    const currentViewerRect = currentViewerImage
      ? toTransitionRect(currentViewerImage.getBoundingClientRect())
      : null;

    const finalizeClose = () => {
      setShowViewer(false);
      clearViewerStateTimer();
      clearViewerStateTimerRef.current = window.setTimeout(() => {
        setViewerImages([]);
        setViewerIndex(0);
        setViewerCurrentIndex(0);
        clearViewerStateTimerRef.current = null;
      }, 40);
    };

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!portal || prefersReducedMotion) {
      finalizeClose();
      return;
    }

    const sourceImage = currentSrc ? getSourceImageBySrc(currentSrc) : null;
    const targetRect = sourceImage ? toTransitionRect(sourceImage.getBoundingClientRect()) : null;

    clearViewerCloseTransition();
    clearSharedImageTransition();
    isViewerClosingRef.current = true;

    const portalFadeAnimation = portal.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: VIEWER_CLOSE_ANIMATION_DURATION_MS,
      easing: VIEWER_CLOSE_ANIMATION_EASING,
      fill: 'forwards',
    });
    viewerCloseAnimationRef.current = portalFadeAnimation;

    let floatingImageAnimation: Animation | null = null;
    if (currentSrc && currentViewerRect && targetRect) {
      if (currentViewerImage) {
        currentViewerImage.style.opacity = '0';
      }

      const floatingImage = document.createElement('img');
      floatingImage.src = currentSrc;
      floatingImage.alt = '';
      floatingImage.decoding = 'async';
      floatingImage.loading = 'eager';
      floatingImage.style.position = 'fixed';
      floatingImage.style.left = `${currentViewerRect.left}px`;
      floatingImage.style.top = `${currentViewerRect.top}px`;
      floatingImage.style.width = `${currentViewerRect.width}px`;
      floatingImage.style.height = `${currentViewerRect.height}px`;
      floatingImage.style.borderRadius = '16px';
      floatingImage.style.objectFit = 'contain';
      floatingImage.style.pointerEvents = 'none';
      floatingImage.style.zIndex = '12000';
      floatingImage.style.boxShadow = '0 22px 54px rgba(0, 0, 0, 0.35)';
      floatingImage.style.willChange = 'left, top, width, height, opacity';
      document.body.appendChild(floatingImage);
      transitionImageRef.current = floatingImage;

      floatingImageAnimation = floatingImage.animate(
        [
          {
            left: `${currentViewerRect.left}px`,
            top: `${currentViewerRect.top}px`,
            width: `${currentViewerRect.width}px`,
            height: `${currentViewerRect.height}px`,
            opacity: 1,
          },
          {
            left: `${targetRect.left}px`,
            top: `${targetRect.top}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
            opacity: 1,
          },
        ],
        {
          duration: VIEWER_CLOSE_ANIMATION_DURATION_MS,
          easing: VIEWER_CLOSE_ANIMATION_EASING,
          fill: 'forwards',
        }
      );
      transitionAnimationRef.current = floatingImageAnimation;
    }

    let pendingAnimations = floatingImageAnimation ? 2 : 1;
    let isFinished = false;
    const finishAnimation = () => {
      if (isFinished) {
        return;
      }

      pendingAnimations -= 1;
      if (pendingAnimations > 0) {
        return;
      }

      isFinished = true;
      clearViewerCloseTransition();
      clearSharedImageTransition();
      finalizeClose();
    };

    portalFadeAnimation.onfinish = finishAnimation;
    portalFadeAnimation.oncancel = finishAnimation;

    if (floatingImageAnimation) {
      floatingImageAnimation.onfinish = finishAnimation;
      floatingImageAnimation.oncancel = finishAnimation;
    }
  }, [
    clearViewerStateTimer,
    clearOpenViewerTransitionFrame,
    clearViewerCloseTransition,
    clearSharedImageTransition,
    getCurrentViewerImage,
    getViewerPortalElement,
    getSourceImageBySrc,
    viewerCurrentIndex,
    viewerImages,
  ]);

  useEffect(
    () => () => {
      clearOpenViewerTransitionFrame();
      clearViewerStateTimer();
      clearViewerCloseTransition();
      clearSharedImageTransition();
    },
    [
      clearOpenViewerTransitionFrame,
      clearSharedImageTransition,
      clearViewerCloseTransition,
      clearViewerStateTimer,
    ]
  );

  const options = useMemo<HTMLReactParserOptions>(() => {
    const parserOptions: HTMLReactParserOptions = {
      replace: (domNode) => {
        if (!(domNode instanceof Element)) return;

        if (domNode.name === 'a') {
          const imgInLink = findFirstDescendant(domNode, (element) => element.name === 'img');
          if (imgInLink) {
            const imgProps = attributesToProps(imgInLink.attribs);
            const src = typeof imgProps.src === 'string' ? imgProps.src : '';
            const alt = typeof imgProps.alt === 'string' ? imgProps.alt : imageFallbackAlt;

            return (
              <button
                type="button"
                onClick={(event) => {
                  const triggerImageElement = event.currentTarget.querySelector('img');
                  openImageViewer(
                    src,
                    triggerImageElement instanceof HTMLImageElement ? triggerImageElement : null
                  );
                }}
                className="group/img block w-full cursor-pointer"
              >
                <img
                  {...imgProps}
                  src={src}
                  alt={alt}
                  className={cn(
                    'block h-auto max-w-full rounded-2xl mx-auto transition-all group-hover/img:ring-4 group-hover/img:ring-primary/10',
                    imgProps.className as string
                  )}
                />
              </button>
            );
          }
        }

        if (domNode.name === 'img') {
          const props = attributesToProps(domNode.attribs);
          const src = typeof props.src === 'string' ? props.src : '';
          const alt = typeof props.alt === 'string' ? props.alt : imageFallbackAlt;

          return (
            <button
              type="button"
              onClick={(event) => {
                const triggerImageElement = event.currentTarget.querySelector('img');
                openImageViewer(
                  src,
                  triggerImageElement instanceof HTMLImageElement ? triggerImageElement : null
                );
              }}
              className="group/img block w-full cursor-pointer"
            >
              <img
                {...props}
                src={src}
                alt={alt}
                className={cn(
                  'block h-auto max-w-full rounded-2xl mx-auto transition-all group-hover/img:ring-4 group-hover/img:ring-primary/10',
                  props.className as string
                )}
              />
            </button>
          );
        }

        if (domNode.name === 'pre') {
          const textContent = getTextContent(domNode);
          const defaultLanguage = detectCodeLanguageFromPre(domNode);

          return (
            <CodeBlock
              text={textContent}
              copyLabel={copyCodeLabel}
              languageLabel={codeLanguageLabel}
              defaultLanguage={defaultLanguage}
              codeTheme={codeTheme}
            />
          );
        }

        if (domNode.name === 'table') {
          const codeTable = extractCodeBlockFromTable(domNode);
          if (codeTable) {
            return (
              <CodeBlock
                text={codeTable.codeText}
                copyLabel={copyCodeLabel}
                languageLabel={codeLanguageLabel}
                defaultLanguage={codeTable.defaultLanguage}
                codeTheme={codeTheme}
              />
            );
          }

          return (
            <div className="my-6 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
              <Table className="text-sm">
                {domToReact(domNode.children as any, parserOptions)}
              </Table>
            </div>
          );
        }

        if (domNode.name === 'thead') {
          return <TableHeader>{domToReact(domNode.children as any, parserOptions)}</TableHeader>;
        }

        if (domNode.name === 'tbody') {
          return <TableBody>{domToReact(domNode.children as any, parserOptions)}</TableBody>;
        }

        if (domNode.name === 'tr') {
          return <TableRow>{domToReact(domNode.children as any, parserOptions)}</TableRow>;
        }

        if (domNode.name === 'th') {
          return (
            <TableHead className="h-auto whitespace-normal border-b border-border/60 bg-muted/40 px-4 py-3 font-semibold text-foreground">
              {domToReact(domNode.children as any, parserOptions)}
            </TableHead>
          );
        }

        if (domNode.name === 'td') {
          return (
            <TableCell className="whitespace-normal border-b border-border/40 px-4 py-3 align-top">
              {domToReact(domNode.children as any, parserOptions)}
            </TableCell>
          );
        }

        return undefined;
      },
    };

    return parserOptions;
  }, [codeLanguageLabel, codeTheme, copyCodeLabel, imageFallbackAlt, openImageViewer]);

  const sanitizedHtml = useMemo(() => {
    return DOMPurify.sanitize(html, {
      // biome-ignore lint/style/useNamingConvention: DOMPurify API requires SCREAMING_SNAKE_CASE
      USE_PROFILES: { html: true },
      // biome-ignore lint/style/useNamingConvention: DOMPurify API requires SCREAMING_SNAKE_CASE
      ADD_ATTR: ['target', 'rel'],
    });
  }, [html]);

  const normalizedCustomConversionRules = useMemo(
    () => normalizeCustomConversionRules(customConversionRules),
    [customConversionRules]
  );

  const chineseConvertedHtml = useMemo(() => {
    return convertChineseHtml(
      sanitizedHtml,
      chineseConversionMode,
      normalizedCustomConversionRules
    );
  }, [sanitizedHtml, chineseConversionMode, normalizedCustomConversionRules]);

  const displayHtml = useMemo(() => {
    if (!bionicEnglish) {
      return chineseConvertedHtml;
    }
    return applyBionicReadingToHtml(chineseConvertedHtml);
  }, [bionicEnglish, chineseConvertedHtml]);

  const parsedHtml = useMemo(() => parse(displayHtml, options), [displayHtml, options]);

  return (
    <>
      <div className={cn('safe-html-content', className)} style={style}>
        {parsedHtml}
      </div>

      <ImageViewer
        images={viewerImages}
        startIndex={viewerIndex}
        open={showViewer}
        onOpenChange={(open) => {
          if (!open) {
            closeImageViewer();
          }
        }}
        onRequestClose={closeImageViewer}
        onViewIndexChange={setViewerCurrentIndex}
      />
    </>
  );
}
