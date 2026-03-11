import {
  ArrowDown01Icon,
  ArrowRightIcon,
  ArrowTurnUpIcon,
  ArrowUp01Icon,
  Copy01Icon,
  Download01Icon,
  Globe02Icon,
  Link01Icon,
  Mail01Icon,
  MailOpen01Icon,
  PlayIcon,
  Playlist03Icon,
  SentIcon,
  SparklesIcon,
  StarIcon,
  ViewIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArticleSummaryCard, useArticleSummary } from '@/components/miniflux/ArticleSummary';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/sonner';
import { useGestureSettings } from '@/hooks/use-gesture-settings';
import { detectSourceLanguage, useReaderSettings } from '@/hooks/use-reader-settings';
import { useShortcutConfig } from '@/hooks/use-shortcut-config';
import { getGestureAction } from '@/lib/gesture-actions';
import { logger } from '@/lib/logger';
import { getPodcastEnclosure } from '@/lib/podcast-utils';
import { getReaderFontStack } from '@/lib/reader-fonts';
import {
  getReaderThemePalette,
  normalizeReaderTheme,
  readerThemeOptions,
} from '@/lib/reader-theme';
import { formatShortcutDisplay, matchesShortcut } from '@/lib/shortcut-registry';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { getVideoEmbedHtml } from '@/lib/video-embed-utils';
import {
  useEntry,
  useFetchEntryContent,
  useToggleEntryRead,
  useToggleEntryStar,
} from '@/services/miniflux/entries';
import type { TranslationRoutingPreferences } from '@/services/translation';
import { EntryReadingHeader } from './EntryReadingHeader';
import { buildEntryContentWithToc } from './entry-toc';
import { ImmersiveTranslationLayer } from './ImmersiveTranslationLayer';
import { ReaderSelectionToolbar } from './ReaderSelectionToolbar';
import { TranslationProgressRing } from './TranslationProgressRing';

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 24;
const MIN_LINE_WIDTH = 45;
const MAX_LINE_WIDTH = 80;
const MIN_LINE_HEIGHT = 1.4;
const MAX_LINE_HEIGHT = 2.2;
const LINE_HEIGHT_STEP = 0.05;

interface EntryReadingProps {
  entryId: string;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  onClose?: () => void;
  onScroll?: (scrollData: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    isAtBottom: boolean;
  }) => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  nextEntryTitle?: string;
  transitionDirection?: 'forward' | 'backward';
  hideNavigation?: boolean;
  onOpenInAppBrowser?: (url: string) => void;
}

export function EntryReading({
  entryId,
  onNavigatePrev,
  onNavigateNext,
  onClose,
  onScroll,
  hasPrev = false,
  hasNext = false,
  nextEntryTitle,
  transitionDirection = 'forward',
  hideNavigation = false,
  onOpenInAppBrowser,
}: EntryReadingProps) {
  const { _ } = useLingui();
  const {
    chineseConversionMode,
    customConversionRules,
    bionicReading,
    fontSize,
    lineWidth,
    lineHeight,
    fontFamily,
    readerTheme,
    codeTheme,
    statusBarVisible,
    translationDisplayMode,
    translationRouteMode,
    translationTargetLanguage,
    translationPrimaryEngine,
    translationEngineFallbacks,
    translationLlmFallbacks,
    appleTranslationFallbackEnabled,
    translationAutoEnabled,
    translationExcludedFeedIds,
    translationExcludedCategoryIds,
    translationSkipSourceLanguages,
    translationProviderSettings,
    focusMode,
    autoMarkRead,
    aiSummaryAutoEnabled,
    setFocusMode,
    setTranslationAutoEnabled,
    setTranslationExcludedFeedIds,
    setTranslationExcludedCategoryIds,
    setFontSize,
    setLineWidth,
    setLineHeight,
    setReaderTheme,
    setStatusBarVisible,
    setTranslationDisplayMode,
    setTranslationTargetLanguage,
  } = useReaderSettings();
  const { swipeLeftAction, swipeRightAction, pullTopAction, pullBottomAction, swipeThreshold } =
    useGestureSettings();
  const { resolved: shortcuts } = useShortcutConfig();
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;
  const { data: entry, isLoading, error } = useEntry(entryId);
  const fetchEntryContent = useFetchEntryContent();
  const toggleStar = useToggleEntryStar();
  const toggleEntryRead = useToggleEntryRead();
  const toggleEntryReadRef = useRef(toggleEntryRead);
  toggleEntryReadRef.current = toggleEntryRead;
  const toggleStarRef = useRef(toggleStar);
  toggleStarRef.current = toggleStar;
  const onOpenInAppBrowserRef = useRef(onOpenInAppBrowser);
  onOpenInAppBrowserRef.current = onOpenInAppBrowser;
  const swipeLeftActionRef = useRef(swipeLeftAction);
  swipeLeftActionRef.current = swipeLeftAction;
  const swipeRightActionRef = useRef(swipeRightAction);
  swipeRightActionRef.current = swipeRightAction;
  const pullTopActionRef = useRef(pullTopAction);
  pullTopActionRef.current = pullTopAction;
  const pullBottomActionRef = useRef(pullBottomAction);
  pullBottomActionRef.current = pullBottomAction;
  const onNavigateNextRef = useRef(onNavigateNext);
  onNavigateNextRef.current = onNavigateNext;
  const onNavigatePrevRef = useRef(onNavigatePrev);
  onNavigatePrevRef.current = onNavigatePrev;
  const swipeThresholdRef = useRef(swipeThreshold);
  swipeThresholdRef.current = swipeThreshold;
  const autoMarkReadRef = useRef(autoMarkRead);
  autoMarkReadRef.current = autoMarkRead;
  const translationAutoEnabledRef = useRef(translationAutoEnabled);
  translationAutoEnabledRef.current = translationAutoEnabled;
  const articleSummary = useArticleSummary(
    entryId,
    entry?.content ?? '',
    translationTargetLanguage ?? undefined,
    aiSummaryAutoEnabled
  );
  const articleSummaryRef = useRef(articleSummary);
  articleSummaryRef.current = articleSummary;
  const isExcludedFeed = entry
    ? translationExcludedFeedIds.includes(entry.feed_id) ||
      (entry.feed.category !== null &&
        translationExcludedCategoryIds.includes(entry.feed.category.id))
    : false;
  const isExcludedByLanguage =
    translationSkipSourceLanguages.length > 0 && entry
      ? (() => {
          const detected = detectSourceLanguage(entry.title);
          return (
            detected !== null &&
            translationSkipSourceLanguages.some(
              (lang) =>
                detected === lang ||
                detected.startsWith(`${lang}-`) ||
                lang.startsWith(`${detected}-`)
            )
          );
        })()
      : false;
  const isExcludedFeedRef = useRef(isExcludedFeed || isExcludedByLanguage);
  isExcludedFeedRef.current = isExcludedFeed || isExcludedByLanguage;
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;
  const entryRef = useRef(entry);
  entryRef.current = entry;
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAutoMarkedAsRead = useRef(false);
  const scrollViewportRef = useRef<HTMLElement | null>(null);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const scrollY = useMotionValue(0);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [hoveredHeadingId, setHoveredHeadingId] = useState<string | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [isOriginalContentDownloaded, setIsOriginalContentDownloaded] = useState(false);
  const [contentRevision, setContentRevision] = useState(0);
  const previousEntryIdRef = useRef<string | null>(null);
  const previousContentRef = useRef<string | null>(null);
  const previousDownloadStatusEntryIdRef = useRef<string | null>(null);
  const swipeLeftProgress = useMotionValue(0);
  const swipeLeftHintX = useTransform(swipeLeftProgress, [0, 1], [64, 0]);
  const swipeLeftHintOpacity = useTransform(swipeLeftProgress, [0, 0.15, 1], [0, 0.8, 1]);
  const swipeLeftHintScale = useTransform(
    swipeLeftProgress,
    [0, 0.3, 0.8, 1],
    [0.4, 0.85, 1, 1.05]
  );
  const swipeLeftIconScale = useTransform(
    swipeLeftProgress,
    [0, 0.5, 0.85, 1],
    [0.3, 0.8, 1, 1.25]
  );
  const swipeLeftIconRotate = useTransform(swipeLeftProgress, [0, 0.6, 1], [-90, -15, 0]);
  const swipeLeftLabelOpacity = useTransform(swipeLeftProgress, [0, 0.4, 0.7, 1], [0, 0, 0.6, 1]);
  const swipeLeftLabelX = useTransform(swipeLeftProgress, [0, 0.5, 1], [-8, -4, 0]);
  const [swipeLeftHintVisible, setSwipeLeftHintVisible] = useState(false);
  const swipeRightProgress = useMotionValue(0);
  const swipeRightHintX = useTransform(swipeRightProgress, [0, 1], [-64, 0]);
  const swipeRightHintOpacity = useTransform(swipeRightProgress, [0, 0.15, 1], [0, 0.8, 1]);
  const swipeRightHintScale = useTransform(
    swipeRightProgress,
    [0, 0.3, 0.8, 1],
    [0.4, 0.85, 1, 1.05]
  );
  const swipeRightIconScale = useTransform(
    swipeRightProgress,
    [0, 0.5, 0.85, 1],
    [0.3, 0.8, 1, 1.25]
  );
  const swipeRightIconRotate = useTransform(swipeRightProgress, [0, 0.6, 1], [90, 15, 0]);
  const swipeRightLabelOpacity = useTransform(swipeRightProgress, [0, 0.4, 0.7, 1], [0, 0, 0.6, 1]);
  const swipeRightLabelX = useTransform(swipeRightProgress, [0, 0.5, 1], [8, 4, 0]);
  const [swipeRightHintVisible, setSwipeRightHintVisible] = useState(false);
  // Content slides with swipe — skip translation for browser-open actions (they open a side panel, not navigate away)
  const browserActions = new Set(['open_in_app_browser', 'open_in_external_browser']);
  const swipeContentX = useTransform(
    [swipeLeftProgress, swipeRightProgress],
    (values: number[]) => {
      const left = values[0] ?? 0;
      const right = values[1] ?? 0;
      if (left > 0 && browserActions.has(swipeLeftActionRef.current)) return 0;
      if (right > 0 && browserActions.has(swipeRightActionRef.current)) return 0;
      return left > 0 ? -left * 60 : right * 60;
    }
  );
  // Pull from top/bottom progress and animation
  const pullTopProgress = useMotionValue(0);
  const pullTopHintY = useTransform(pullTopProgress, [0, 1], [-96, 0]);
  const pullTopHintOpacity = useTransform(pullTopProgress, [0, 0.2, 1], [0, 0.7, 1]);
  const pullTopHintScale = useTransform(pullTopProgress, [0, 0.3, 0.8, 1], [0.3, 0.8, 1, 1.08]);
  const pullTopIconScale = useTransform(pullTopProgress, [0, 0.5, 0.85, 1], [0.2, 0.7, 1, 1.3]);
  const pullTopIconRotate = useTransform(pullTopProgress, [0, 0.6, 1], [120, 20, 0]);
  const pullTopLabelOpacity = useTransform(pullTopProgress, [0, 0.5, 0.8, 1], [0, 0, 0.5, 1]);
  const pullTopLabelY = useTransform(pullTopProgress, [0, 0.5, 1], [12, 6, 0]);
  const [pullTopHintVisible, setPullTopHintVisible] = useState(false);
  const pullBottomProgress = useMotionValue(0);
  const pullBottomHintY = useTransform(pullBottomProgress, [0, 1], [96, 0]);
  const pullBottomHintOpacity = useTransform(pullBottomProgress, [0, 0.2, 1], [0, 0.7, 1]);
  const pullBottomHintScale = useTransform(
    pullBottomProgress,
    [0, 0.3, 0.8, 1],
    [0.3, 0.8, 1, 1.08]
  );
  const pullBottomIconScale = useTransform(
    pullBottomProgress,
    [0, 0.5, 0.85, 1],
    [0.2, 0.7, 1, 1.3]
  );
  const pullBottomIconRotate = useTransform(pullBottomProgress, [0, 0.6, 1], [-120, -20, 0]);
  const pullBottomLabelOpacity = useTransform(pullBottomProgress, [0, 0.5, 0.8, 1], [0, 0, 0.5, 1]);
  const pullBottomLabelY = useTransform(pullBottomProgress, [0, 0.5, 1], [-12, -6, 0]);
  const [pullBottomHintVisible, setPullBottomHintVisible] = useState(false);
  // Content shifts vertically with pull gestures — rubber-band drag feel
  const pullContentY = useTransform([pullTopProgress, pullBottomProgress], (values: number[]) => {
    const top = values[0] ?? 0;
    const bottom = values[1] ?? 0;
    if (top > 0) return top ** 0.55 * 150;
    if (bottom > 0) return -(bottom ** 0.55) * 150;
    return 0;
  });
  // Combined scale from swipe + pull gestures (skip for browser-open actions)
  const contentScale = useTransform(
    [swipeLeftProgress, swipeRightProgress, pullTopProgress, pullBottomProgress],
    (values: number[]) => {
      let swipeMax = 0;
      if ((values[0] ?? 0) > 0 && !browserActions.has(swipeLeftActionRef.current))
        swipeMax = values[0] ?? 0;
      if ((values[1] ?? 0) > 0 && !browserActions.has(swipeRightActionRef.current))
        swipeMax = Math.max(swipeMax, values[1] ?? 0);
      const pullProgress = Math.max(values[2] ?? 0, values[3] ?? 0);
      return (1 - swipeMax * 0.02) * (1 - pullProgress * 0.025);
    }
  );
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const translationEnabledRef = useRef(translationEnabled);
  translationEnabledRef.current = translationEnabled;
  const focusModeRef = useRef(focusMode);
  focusModeRef.current = focusMode;
  const [translateRequestToken, setTranslateRequestToken] = useState(0);
  const [activeTranslationProvider, setActiveTranslationProvider] = useState<string | null>(null);
  const [translationProgress, setTranslationProgress] = useState({ completed: 0, total: 0 });

  const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

  const titleOpacity = useTransform(scrollY, [0, 100], [1, 0], { ease: easeOutCubic });
  const titleScale = useTransform(scrollY, [0, 100], [1, 0.95], { ease: easeOutCubic });
  const titleY = useTransform(scrollY, [0, 100], [0, -10], { ease: easeOutCubic });
  const titleMaxHeight = useTransform(scrollY, [0, 100], [200, 0], { ease: easeOutCubic });
  const smallTitleOpacity = useTransform(scrollY, [60, 120], [0, 1], { ease: easeOutCubic });
  const smallTitleHeight = useTransform(scrollY, [60, 120], [0, 32], { ease: easeOutCubic });
  const headerPadding = useTransform(scrollY, [0, 100], [8, 4], { ease: easeOutCubic });
  const readingContent = useMemo(() => {
    const content = entry?.content ?? '';
    // Only prepend a video embed if the content doesn't already contain an iframe
    // (Miniflux typically injects YouTube iframes, but some setups may not)
    const hasIframe = content.includes('<iframe');
    const videoEmbed = !hasIframe && entry?.url ? getVideoEmbedHtml(entry.url) : null;
    const html = videoEmbed ? `${videoEmbed}\n${content}` : content;
    return buildEntryContentWithToc(html);
  }, [entry?.content, entry?.url]);
  const showToc = readingContent.tocItems.length >= 2;
  const activeTocIndex = useMemo(
    () => readingContent.tocItems.findIndex((item) => item.id === activeHeadingId),
    [activeHeadingId, readingContent.tocItems]
  );
  const hoveredTocItem = useMemo(
    () => readingContent.tocItems.find((item) => item.id === hoveredHeadingId) ?? null,
    [hoveredHeadingId, readingContent.tocItems]
  );
  const tocLengthRange = useMemo(() => {
    const sectionLengths = readingContent.tocItems.map((item) => item.sectionLength);
    if (!sectionLengths.length) {
      return { min: 0, max: 0 };
    }

    return {
      min: Math.min(...sectionLengths),
      max: Math.max(...sectionLengths),
    };
  }, [readingContent.tocItems]);
  const previousSectionLabel = _(msg`Previous section`);
  const nextSectionLabel = _(msg`Next section`);
  const tocGroupLabel = _(msg`Article table of contents`);
  const canJumpPrev = activeTocIndex > 0;
  const canJumpNext = activeTocIndex >= 0 && activeTocIndex < readingContent.tocItems.length - 1;
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const articleSlideDistance = 18;
  const articleLiftOffset = 8;
  const articleEnterOpacity = 0;
  const articleExitOpacity = 0;
  const directionalEnterY =
    transitionDirection === 'backward' ? -articleSlideDistance : articleSlideDistance;
  const directionalExitY = -articleLiftOffset;
  const articleEnterTransition = prefersReducedMotion
    ? { duration: 0 }
    : {
        y: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
        filter: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
        opacity: { duration: 0.32, ease: [0.2, 0.95, 0.35, 1] as const },
      };
  const articleExitTransition = prefersReducedMotion
    ? { duration: 0 }
    : {
        y: { duration: 0.3, ease: [0.35, 0, 0.9, 1] as const },
        filter: { duration: 0.28, ease: [0.35, 0, 0.9, 1] as const },
        opacity: { duration: 0.24, ease: [0.45, 0, 1, 1] as const },
      };
  const readerThemePalette = useMemo(() => getReaderThemePalette(readerTheme), [readerTheme]);
  const useInvertedProse = readerTheme === 'slate' || readerTheme === 'oled';
  const estimatedTotalMinutes = useMemo(() => {
    if (!entry) {
      return 1;
    }

    if (entry.reading_time && entry.reading_time > 0) {
      return entry.reading_time;
    }

    const plainText = entry.content?.replace(/<[^>]*>/g, ' ') ?? '';
    const wordCount = plainText
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;

    return Math.max(1, Math.ceil(wordCount / 220));
  }, [entry]);
  const minutesLeft = useMemo(() => {
    const remaining = estimatedTotalMinutes * (1 - readingProgress / 100);
    return Math.max(0, Math.ceil(remaining));
  }, [estimatedTotalMinutes, readingProgress]);
  const progressPercent = Math.max(0, Math.min(100, Math.round(readingProgress)));
  const progressLabel = _(msg`${progressPercent}% read`);
  const minutesLeftLabel = _(msg`${minutesLeft} min left`);
  const hideReadingStatusLabel = _(msg`Hide reading status`);
  const showReadingStatusLabel = _(msg`Show reading status`);
  const scrollToTopLabel = _(msg`Scroll to top`);
  const floatingToolbarButtonClass =
    'h-9 w-9 rounded-xl border border-transparent text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/10 hover:text-muted-foreground focus-visible:text-muted-foreground active:text-muted-foreground aria-expanded:text-muted-foreground';
  const readerSurfaceStyle = useMemo(
    () => ({
      willChange: 'transform, opacity, filter',
      backgroundColor: readerThemePalette.surface,
      color: readerThemePalette.text,
    }),
    [readerThemePalette.surface, readerThemePalette.text]
  );
  const readerProseStyle = useMemo(
    () =>
      ({
        maxWidth: `${lineWidth}ch`,
        fontSize: `${fontSize}px`,
        lineHeight,
        fontFamily: getReaderFontStack(fontFamily),
        '--reader-link': readerThemePalette.link,
        '--tw-prose-body': readerThemePalette.text,
        '--tw-prose-headings': readerThemePalette.text,
        '--tw-prose-lead': readerThemePalette.muted,
        '--tw-prose-links': readerThemePalette.link,
        '--tw-prose-bold': readerThemePalette.text,
        '--tw-prose-counters': readerThemePalette.muted,
        '--tw-prose-bullets': readerThemePalette.muted,
        '--tw-prose-hr': readerThemePalette.border,
        '--tw-prose-quotes': readerThemePalette.text,
        '--tw-prose-quote-borders': readerThemePalette.border,
        '--tw-prose-captions': readerThemePalette.muted,
        '--tw-prose-code': readerThemePalette.text,
        '--tw-prose-pre-code': readerThemePalette.text,
        '--tw-prose-pre-bg': 'color-mix(in oklch, var(--reader-link) 10%, transparent)',
        '--tw-prose-th-borders': readerThemePalette.border,
        '--tw-prose-td-borders': readerThemePalette.border,
      }) as CSSProperties,
    [
      fontFamily,
      fontSize,
      lineHeight,
      lineWidth,
      readerThemePalette.border,
      readerThemePalette.link,
      readerThemePalette.muted,
      readerThemePalette.text,
    ]
  );
  const translationPreferences: TranslationRoutingPreferences = useMemo(
    () => ({
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_route_mode: translationRouteMode,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_target_language: translationTargetLanguage ?? 'en',
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_primary_engine: translationPrimaryEngine,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_engine_fallbacks: translationEngineFallbacks,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_llm_fallbacks: translationLlmFallbacks,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_apple_fallback_enabled: appleTranslationFallbackEnabled,
    }),
    [
      appleTranslationFallbackEnabled,
      translationEngineFallbacks,
      translationLlmFallbacks,
      translationPrimaryEngine,
      translationRouteMode,
      translationTargetLanguage,
    ]
  );

  const cancelScrollAnimation = useCallback(() => {
    if (scrollAnimationFrameRef.current !== null) {
      cancelAnimationFrame(scrollAnimationFrameRef.current);
      scrollAnimationFrameRef.current = null;
    }
  }, []);

  const animateViewportScrollTo = useCallback(
    (viewport: HTMLElement, targetTop: number) => {
      const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const clampedTargetTop = Math.max(0, Math.min(targetTop, maxTop));

      if (prefersReducedMotion) {
        cancelScrollAnimation();
        viewport.scrollTop = clampedTargetTop;
        return;
      }

      const startTop = viewport.scrollTop;
      const delta = clampedTargetTop - startTop;
      if (Math.abs(delta) < 1) {
        viewport.scrollTop = clampedTargetTop;
        return;
      }

      const duration = Math.max(260, Math.min(760, Math.abs(delta) * 0.65));
      const startTime = performance.now();
      const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

      cancelScrollAnimation();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const easedProgress = easeInOutCubic(progress);
        viewport.scrollTop = startTop + delta * easedProgress;

        if (progress < 1) {
          scrollAnimationFrameRef.current = requestAnimationFrame(step);
          return;
        }

        scrollAnimationFrameRef.current = null;
      };

      scrollAnimationFrameRef.current = requestAnimationFrame(step);
    },
    [cancelScrollAnimation, prefersReducedMotion]
  );

  const getTocBarWidth = useCallback(
    (sectionLength: number) => {
      if (tocLengthRange.max === tocLengthRange.min) {
        return 24;
      }

      const ratio =
        (sectionLength - tocLengthRange.min) / (tocLengthRange.max - tocLengthRange.min);
      return Math.round(10 + ratio * 30);
    },
    [tocLengthRange]
  );

  const handleTocNavigation = useCallback(
    (headingId: string) => {
      const viewport = scrollViewportRef.current;
      if (!viewport) {
        return;
      }

      const targetHeading = Array.from(
        viewport.querySelectorAll<HTMLElement>('[data-reading-heading="true"]')
      ).find((headingElement) => headingElement.id === headingId);
      if (!targetHeading) {
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const targetRect = targetHeading.getBoundingClientRect();
      const nextScrollTop = targetRect.top - viewportRect.top + viewport.scrollTop - 96;

      animateViewportScrollTo(viewport, nextScrollTop);
      setActiveHeadingId(headingId);
    },
    [animateViewportScrollTo]
  );
  const handleJumpBySection = useCallback(
    (direction: -1 | 1) => {
      if (!readingContent.tocItems.length) {
        return;
      }

      const baseIndex = activeTocIndex >= 0 ? activeTocIndex : 0;
      const nextIndex = Math.max(
        0,
        Math.min(readingContent.tocItems.length - 1, baseIndex + direction)
      );
      const nextItem = readingContent.tocItems[nextIndex];

      if (nextItem) {
        handleTocNavigation(nextItem.id);
      }
    },
    [activeTocIndex, handleTocNavigation, readingContent.tocItems]
  );
  const handleScrollToTop = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }
    animateViewportScrollTo(viewport, 0);
  }, [animateViewportScrollTo]);

  useEffect(() => {
    if (entry) {
      logger.info('Entry loaded for reading', { id: entry.id, title: entry.title });
    }
    hasAutoMarkedAsRead.current = false;
  }, [entry]);

  useEffect(() => {
    const currentEntryId = entry?.id ?? null;
    if (previousDownloadStatusEntryIdRef.current !== currentEntryId) {
      previousDownloadStatusEntryIdRef.current = currentEntryId;
      setIsOriginalContentDownloaded(false);
    }
  }, [entry]);

  const handleFetchOriginalContent = useCallback(() => {
    if (!entry) {
      return;
    }

    fetchEntryContent.mutate(
      { id: entry.id, updateContent: true },
      {
        onSuccess: () => {
          setIsOriginalContentDownloaded(true);
        },
      }
    );
  }, [entry, fetchEntryContent]);

  const handleSaveToServices = useCallback(async () => {
    if (!entry) return;
    try {
      const result = await commands.saveEntry(entry.id);
      if (result.status === 'error') {
        showToast.error(_(msg`Failed to save entry`), result.error);
        return;
      }
      showToast.success(_(msg`Entry sent to services`), entry.title);
    } catch (error) {
      showToast.error(
        _(msg`Failed to save entry`),
        error instanceof Error ? error.message : String(error)
      );
    }
  }, [entry, _]);

  useEffect(() => {
    if (!entry) {
      return;
    }

    const currentContent = entry.content ?? '';

    if (previousEntryIdRef.current !== entry.id) {
      previousEntryIdRef.current = entry.id;
      previousContentRef.current = currentContent;
      setContentRevision(0);
      return;
    }

    if (previousContentRef.current !== currentContent) {
      previousContentRef.current = currentContent;
      setContentRevision((value) => value + 1);
    }
  }, [entry]);

  useEffect(() => {
    if (!entryId) {
      return;
    }
    const shouldTranslate = translationAutoEnabledRef.current && !isExcludedFeedRef.current;
    setTranslationEnabled(shouldTranslate);
    setTranslateRequestToken(shouldTranslate ? 1 : 0);
    setActiveTranslationProvider(null);
    setTranslationProgress({ completed: 0, total: 0 });
  }, [entryId]);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    if (!viewport) return;

    scrollViewportRef.current = viewport;
    cancelScrollAnimation();
    viewport.scrollTop = 0;
    scrollY.set(0);
    setReadingProgress(0);
    setActiveHeadingId(readingContent.tocItems[0]?.id ?? null);

    requestAnimationFrame(() => {
      viewport.focus({ preventScroll: true });
    });

    // Run an initial scroll check after content renders, so short articles
    // or the first entry after startup still get auto-marked as read.
    const initialCheckTimer = setTimeout(() => {
      const maxScrollable = viewport.scrollHeight - viewport.clientHeight;
      const progress =
        maxScrollable <= 0 ? 100 : Math.round((viewport.scrollTop / maxScrollable) * 100);
      const normalizedProgress = Math.max(0, Math.min(100, progress));
      if (autoMarkReadRef.current) {
        const currentEntry = entryRef.current;
        if (
          currentEntry &&
          currentEntry.status !== 'read' &&
          !hasAutoMarkedAsRead.current &&
          normalizedProgress >= 20
        ) {
          hasAutoMarkedAsRead.current = true;
          toggleEntryReadRef.current.mutate(currentEntry.id);
        }
      }
    }, 500);

    const handleScroll = () => {
      scrollY.set(viewport.scrollTop);
      const maxScrollable = viewport.scrollHeight - viewport.clientHeight;
      const progress =
        maxScrollable <= 0 ? 100 : Math.round((viewport.scrollTop / maxScrollable) * 100);
      const normalizedProgress = Math.max(0, Math.min(100, progress));
      setReadingProgress((prev) => (prev === normalizedProgress ? prev : normalizedProgress));

      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      const atBottom = distanceFromBottom < 200;
      setIsAtBottom(atBottom);

      if (onScrollRef.current) {
        onScrollRef.current({
          scrollTop: viewport.scrollTop,
          scrollHeight: viewport.scrollHeight,
          clientHeight: viewport.clientHeight,
          isAtBottom: atBottom,
        });
      }

      if (autoMarkReadRef.current) {
        const currentEntry = entryRef.current;
        if (
          currentEntry &&
          currentEntry.status !== 'read' &&
          !hasAutoMarkedAsRead.current &&
          normalizedProgress >= 20
        ) {
          hasAutoMarkedAsRead.current = true;
          toggleEntryReadRef.current.mutate(currentEntry.id);
        }
      }

      if (!showToc) {
        return;
      }

      const headingElements = Array.from(
        viewport.querySelectorAll<HTMLElement>('[data-reading-heading="true"]')
      );
      if (!headingElements.length) {
        return;
      }

      const activationTop = viewport.getBoundingClientRect().top + 120;
      let currentHeadingId = headingElements[0]?.id ?? null;

      for (const headingElement of headingElements) {
        if (headingElement.getBoundingClientRect().top <= activationTop) {
          currentHeadingId = headingElement.id;
          continue;
        }
        break;
      }

      setActiveHeadingId((prev) => (prev === currentHeadingId ? prev : currentHeadingId));
    };

    handleScroll();
    viewport.addEventListener('scroll', handleScroll, { passive: true });

    // Dispatch a gesture action by id
    const dispatchGestureAction = (actionId: string) => {
      const currentEntry = entryRef.current;
      switch (actionId) {
        case 'open_in_app_browser':
          if (currentEntry?.url && onOpenInAppBrowserRef.current) {
            onOpenInAppBrowserRef.current(currentEntry.url);
          }
          break;
        case 'open_in_external_browser':
          if (currentEntry?.url) window.open(currentEntry.url, '_blank', 'noopener,noreferrer');
          break;
        case 'toggle_read':
          if (currentEntry) toggleEntryReadRef.current.mutate(currentEntry.id);
          break;
        case 'toggle_star':
          if (currentEntry) toggleStarRef.current.mutate(currentEntry.id);
          break;
        case 'next_article':
          onNavigateNextRef.current?.();
          break;
        case 'prev_article':
          onNavigatePrevRef.current?.();
          break;
        case 'close_browser':
          // close_browser only applies in browser pane context, no-op in reader
          break;
        default:
          break;
      }
    };

    // Horizontal swipe gestures (trackpad scroll)
    let swipeLeftCumulativeX = 0;
    let swipeRightCumulativeX = 0;
    let swipeResetTimer: ReturnType<typeof setTimeout> | null = null;
    let swipeLeftTriggered = false;
    let swipeRightTriggered = false;
    // Pull-from-bottom accumulator
    let pullTopCumulativeY = 0;
    let pullTopResetTimer: ReturnType<typeof setTimeout> | null = null;
    let pullTopTriggered = false;
    let pullBottomCumulativeY = 0;
    let pullBottomResetTimer: ReturnType<typeof setTimeout> | null = null;
    let pullBottomTriggered = false;

    const onWheel = (e: WheelEvent) => {
      const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);

      if (isHorizontal) {
        // Swipe left = positive deltaX
        if (e.deltaX > 0) {
          // Reset right-swipe state
          swipeRightCumulativeX = 0;
          swipeRightProgress.set(0);
          setSwipeRightHintVisible(false);

          const leftAction = swipeLeftActionRef.current;
          if (leftAction === 'none') return;

          swipeLeftCumulativeX += e.deltaX;
          const threshold = swipeThresholdRef.current;
          const progress = Math.min(1, swipeLeftCumulativeX / threshold);
          swipeLeftProgress.set(progress);
          if (progress > 0) setSwipeLeftHintVisible(true);

          if (swipeLeftCumulativeX >= threshold && !swipeLeftTriggered) {
            swipeLeftTriggered = true;
            dispatchGestureAction(leftAction);
          }
        } else if (e.deltaX < 0) {
          // Swipe right = negative deltaX
          // Reset left-swipe state
          swipeLeftCumulativeX = 0;
          swipeLeftProgress.set(0);
          setSwipeLeftHintVisible(false);

          const rightAction = swipeRightActionRef.current;
          // close_browser only works in browser pane, skip in reader
          if (rightAction === 'none' || rightAction === 'close_browser') return;

          swipeRightCumulativeX += Math.abs(e.deltaX);
          const threshold = swipeThresholdRef.current;
          const progress = Math.min(1, swipeRightCumulativeX / threshold);
          swipeRightProgress.set(progress);
          if (progress > 0) setSwipeRightHintVisible(true);

          if (swipeRightCumulativeX >= threshold && !swipeRightTriggered) {
            swipeRightTriggered = true;
            dispatchGestureAction(rightAction);
          }
        }

        if (swipeResetTimer) clearTimeout(swipeResetTimer);
        swipeResetTimer = setTimeout(() => {
          swipeLeftCumulativeX = 0;
          swipeRightCumulativeX = 0;
          swipeLeftTriggered = false;
          swipeRightTriggered = false;
          const springConfig = { type: 'spring' as const, stiffness: 300, damping: 25 };
          animate(swipeLeftProgress, 0, springConfig).then(() => setSwipeLeftHintVisible(false));
          animate(swipeRightProgress, 0, springConfig).then(() => setSwipeRightHintVisible(false));
        }, 300);
      }

      // Pull from top → configurable action (1.5x threshold for vertical pulls)
      if (e.deltaY < 0) {
        const topAction = pullTopActionRef.current;
        if (topAction === 'none') return;

        const vp = scrollViewportRef.current;
        if (!vp) return;
        const atTop = vp.scrollTop < 2;
        if (!atTop) {
          pullTopCumulativeY = 0;
          pullTopTriggered = false;
          animate(pullTopProgress, 0, { type: 'spring', stiffness: 300, damping: 25 }).then(() =>
            setPullTopHintVisible(false)
          );
          return;
        }

        pullTopCumulativeY += Math.abs(e.deltaY);
        const threshold = Math.round(swipeThresholdRef.current * 2.5);
        const progress = Math.min(1, pullTopCumulativeY / threshold);
        pullTopProgress.set(progress);
        if (progress > 0) setPullTopHintVisible(true);

        if (pullTopCumulativeY >= threshold && !pullTopTriggered) {
          pullTopTriggered = true;
          dispatchGestureAction(topAction);
        }

        if (pullTopResetTimer) clearTimeout(pullTopResetTimer);
        pullTopResetTimer = setTimeout(() => {
          pullTopCumulativeY = 0;
          pullTopTriggered = false;
          animate(pullTopProgress, 0, { type: 'spring', stiffness: 300, damping: 25 }).then(() =>
            setPullTopHintVisible(false)
          );
        }, 400);
      }

      // Pull from bottom → configurable action (1.5x threshold for vertical pulls)
      if (e.deltaY > 0) {
        const bottomAction = pullBottomActionRef.current;
        if (bottomAction === 'none') return;

        const vp = scrollViewportRef.current;
        if (!vp) return;
        const atBottom = vp.scrollHeight - vp.scrollTop - vp.clientHeight < 2;
        if (!atBottom) {
          pullBottomCumulativeY = 0;
          pullBottomTriggered = false;
          animate(pullBottomProgress, 0, { type: 'spring', stiffness: 300, damping: 25 }).then(() =>
            setPullBottomHintVisible(false)
          );
          return;
        }

        pullBottomCumulativeY += e.deltaY;
        const threshold = Math.round(swipeThresholdRef.current * 2.5);
        const progress = Math.min(1, pullBottomCumulativeY / threshold);
        pullBottomProgress.set(progress);
        if (progress > 0) setPullBottomHintVisible(true);

        if (pullBottomCumulativeY >= threshold && !pullBottomTriggered) {
          pullBottomTriggered = true;
          dispatchGestureAction(bottomAction);
        }

        if (pullBottomResetTimer) clearTimeout(pullBottomResetTimer);
        pullBottomResetTimer = setTimeout(() => {
          pullBottomCumulativeY = 0;
          pullBottomTriggered = false;
          animate(pullBottomProgress, 0, { type: 'spring', stiffness: 300, damping: 25 }).then(() =>
            setPullBottomHintVisible(false)
          );
        }, 400);
      }
    };

    viewport.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      clearTimeout(initialCheckTimer);
      viewport.removeEventListener('scroll', handleScroll);
      viewport.removeEventListener('wheel', onWheel);
      if (swipeResetTimer) clearTimeout(swipeResetTimer);
      if (pullTopResetTimer) clearTimeout(pullTopResetTimer);
      if (pullBottomResetTimer) clearTimeout(pullBottomResetTimer);
    };
  }, [
    cancelScrollAnimation,
    readingContent.tocItems,
    scrollY,
    showToc,
    swipeLeftProgress,
    swipeRightProgress,
    pullTopProgress,
    pullBottomProgress,
  ]);

  // Focus mode: dim all reader nodes except the one closest to viewport center
  useEffect(() => {
    if (!focusMode) {
      // Remove all focus attributes when disabled
      const viewport = scrollViewportRef.current;
      if (viewport) {
        for (const node of viewport.querySelectorAll<HTMLElement>('[data-reader-node]')) {
          node.removeAttribute('data-focused');
        }
      }
      return;
    }

    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    let rafId: number | null = null;

    const updateFocus = () => {
      rafId = null;
      const nodes = viewport.querySelectorAll<HTMLElement>('[data-reader-node]');
      if (!nodes.length) return;

      const viewportRect = viewport.getBoundingClientRect();
      const centerY = viewportRect.top + viewportRect.height / 2;
      let closestNode: HTMLElement | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        const nodeCenter = rect.top + rect.height / 2;
        const distance = Math.abs(nodeCenter - centerY);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestNode = node;
        }
      }

      for (const node of nodes) {
        if (node === closestNode) {
          node.setAttribute('data-focused', 'true');
        } else {
          node.removeAttribute('data-focused');
        }
      }
    };

    const handleFocusScroll = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(updateFocus);
      }
    };

    updateFocus();
    viewport.addEventListener('scroll', handleFocusScroll, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', handleFocusScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
      // Clean up focus attributes
      for (const node of viewport.querySelectorAll<HTMLElement>('[data-reader-node]')) {
        node.removeAttribute('data-focused');
      }
    };
  }, [focusMode]);

  const handleTranslationEnabledChange = useCallback(
    (enabled: boolean) => {
      setTranslationEnabled(enabled);
      setTranslationAutoEnabled(enabled);
      if (enabled) {
        setTranslateRequestToken((previousToken) => previousToken + 1);
      }
    },
    [setTranslationAutoEnabled]
  );

  useEffect(() => {
    const match = (id: string, e: KeyboardEvent) =>
      matchesShortcut(e, shortcutsRef.current[id] ?? '');

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputTarget =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      if (isInputTarget || e.defaultPrevented) {
        return;
      }

      const viewport = scrollRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]'
      );

      // Reading — scroll
      if (match('scroll-down', e)) {
        if (!viewport) return;
        e.preventDefault();
        const amount = viewport.clientHeight * 0.8;
        animateViewportScrollTo(viewport, viewport.scrollTop + amount);
      } else if (match('scroll-up', e)) {
        if (!viewport) return;
        e.preventDefault();
        const amount = viewport.clientHeight * 0.8;
        animateViewportScrollTo(viewport, viewport.scrollTop - amount);
      } else if (match('scroll-line-down', e)) {
        if (!viewport) return;
        e.preventDefault();
        animateViewportScrollTo(viewport, viewport.scrollTop + 80);
      } else if (match('scroll-line-up', e)) {
        if (!viewport) return;
        e.preventDefault();
        animateViewportScrollTo(viewport, viewport.scrollTop - 80);
      }
      // Reading — typography
      else if (match('increase-line-height', e)) {
        e.preventDefault();
        setLineHeight(
          Math.min(MAX_LINE_HEIGHT, Number((lineHeight + LINE_HEIGHT_STEP).toFixed(2)))
        );
      } else if (match('decrease-line-height', e)) {
        e.preventDefault();
        setLineHeight(
          Math.max(MIN_LINE_HEIGHT, Number((lineHeight - LINE_HEIGHT_STEP).toFixed(2)))
        );
      } else if (match('increase-font', e)) {
        e.preventDefault();
        setFontSize(Math.min(MAX_FONT_SIZE, fontSize + 1));
      } else if (match('decrease-font', e)) {
        e.preventDefault();
        setFontSize(Math.max(MIN_FONT_SIZE, fontSize - 1));
      } else if (match('narrow-content', e)) {
        e.preventDefault();
        setLineWidth(Math.max(MIN_LINE_WIDTH, lineWidth - 2));
      } else if (match('widen-content', e)) {
        e.preventDefault();
        setLineWidth(Math.min(MAX_LINE_WIDTH, lineWidth + 2));
      } else if (match('cycle-theme', e)) {
        e.preventDefault();
        const currentTheme = normalizeReaderTheme(readerTheme);
        const currentIndex = readerThemeOptions.indexOf(currentTheme);
        const nextIndex = (currentIndex + 1) % readerThemeOptions.length;
        const nextTheme = readerThemeOptions[nextIndex];
        if (nextTheme) setReaderTheme(nextTheme);
      }
      // Navigation
      else if (match('prev-article', e)) {
        if (hasPrev && onNavigatePrev) {
          e.preventDefault();
          onNavigatePrev();
        }
      } else if (match('next-article', e)) {
        if (hasNext && onNavigateNext) {
          e.preventDefault();
          onNavigateNext();
        }
      } else if (match('go-to-top', e)) {
        if (!viewport) return;
        e.preventDefault();
        animateViewportScrollTo(viewport, 0);
      }
      // Article actions
      else if (match('toggle-read', e)) {
        const currentEntry = entryRef.current;
        if (currentEntry && !toggleEntryReadRef.current.isPending) {
          e.preventDefault();
          toggleEntryReadRef.current.mutate(currentEntry.id);
        }
      } else if (match('summarize', e)) {
        const summary = articleSummaryRef.current;
        if (!summary.loading) {
          e.preventDefault();
          summary.handleSummarize();
        }
      } else if (match('toggle-star', e)) {
        const currentEntry = entryRef.current;
        if (currentEntry && !toggleStarRef.current.isPending) {
          e.preventDefault();
          toggleStarRef.current.mutate(currentEntry.id);
        }
      } else if (match('toggle-translation', e)) {
        e.preventDefault();
        handleTranslationEnabledChange(!translationEnabledRef.current);
      } else if (match('toggle-focus-mode', e)) {
        e.preventDefault();
        setFocusMode(!focusModeRef.current);
      } else if (match('fetch-content', e)) {
        e.preventDefault();
        handleFetchOriginalContent();
      }
      // Links
      else if (match('open-browser', e)) {
        const currentEntry = entryRef.current;
        if (currentEntry?.url) {
          e.preventDefault();
          window.open(currentEntry.url, '_blank', 'noopener,noreferrer');
        }
      } else if (match('open-app-browser', e)) {
        const currentEntry = entryRef.current;
        if (currentEntry?.url && onOpenInAppBrowserRef.current) {
          e.preventDefault();
          onOpenInAppBrowserRef.current(currentEntry.url);
        }
      } else if (match('copy-link', e)) {
        const currentEntry = entryRef.current;
        if (currentEntry?.url) {
          e.preventDefault();
          navigator.clipboard.writeText(currentEntry.url);
        }
      }
      // Podcast
      else if (match('podcast-play', e)) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('command:podcast-play-pause'));
      } else if (match('podcast-queue', e)) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('command:podcast-add-to-playlist'));
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    animateViewportScrollTo,
    fontSize,
    handleFetchOriginalContent,
    hasNext,
    hasPrev,
    lineHeight,
    lineWidth,
    onNavigateNext,
    onNavigatePrev,
    readerTheme,
    setFontSize,
    setLineHeight,
    setLineWidth,
    setReaderTheme,
    handleTranslationEnabledChange,
    setFocusMode,
  ]);

  useEffect(() => {
    if (!showToc) {
      setHoveredHeadingId(null);
    }
  }, [showToc]);

  useEffect(() => {
    return () => {
      cancelScrollAnimation();
    };
  }, [cancelScrollAnimation]);

  // Listen for command palette / menu bar translation events
  useEffect(() => {
    const handleTranslateCommand = () => {
      handleTranslationEnabledChange(!translationEnabled);
    };
    const handleDisplayModeCommand = (e: Event) => {
      const mode = (e as CustomEvent).detail;
      if (mode === 'bilingual' || mode === 'translated_only') {
        setTranslationDisplayMode(mode);
      }
    };
    document.addEventListener('command:translate', handleTranslateCommand);
    document.addEventListener('command:set-translation-display-mode', handleDisplayModeCommand);
    return () => {
      document.removeEventListener('command:translate', handleTranslateCommand);
      document.removeEventListener(
        'command:set-translation-display-mode',
        handleDisplayModeCommand
      );
    };
  }, [handleTranslationEnabledChange, translationEnabled, setTranslationDisplayMode]);

  // Listen for command palette / menu bar article events
  useEffect(() => {
    const handlers: Record<string, () => void> = {
      'command:toggle-read': () => {
        if (entry) toggleEntryRead.mutate(entry.id);
      },
      'command:toggle-star': () => {
        if (entry) toggleStar.mutate(entry.id);
      },
      'command:fetch-content': () => handleFetchOriginalContent(),
      'command:open-in-browser': () => {
        if (entry?.url) window.open(entry.url, '_blank', 'noopener,noreferrer');
      },
      'command:open-in-app-browser': () => {
        if (entry?.url && onOpenInAppBrowser) onOpenInAppBrowser(entry.url);
      },
      'command:copy-link': () => {
        if (entry?.url) navigator.clipboard.writeText(entry.url);
      },
      'command:prev-article': () => onNavigatePrev?.(),
      'command:next-article': () => onNavigateNext?.(),
      'command:font-size-increase': () => setFontSize(Math.min(MAX_FONT_SIZE, fontSize + 1)),
      'command:font-size-decrease': () => setFontSize(Math.max(MIN_FONT_SIZE, fontSize - 1)),
      'command:font-size-reset': () => setFontSize(18),
      'command:toggle-focus-mode': () => setFocusMode(!focusModeRef.current),
    };
    const handleSetTheme = (e: Event) => {
      const theme = (e as CustomEvent).detail;
      if (theme) setReaderTheme(theme);
    };
    for (const [event, handler] of Object.entries(handlers)) {
      document.addEventListener(event, handler);
    }
    document.addEventListener('command:set-reader-theme', handleSetTheme);
    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        document.removeEventListener(event, handler);
      }
      document.removeEventListener('command:set-reader-theme', handleSetTheme);
    };
  }, [
    entry,
    toggleEntryRead,
    toggleStar,
    handleFetchOriginalContent,
    onOpenInAppBrowser,
    onNavigatePrev,
    onNavigateNext,
    fontSize,
    setFontSize,
    setReaderTheme,
    setFocusMode,
  ]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-3xl space-y-6 p-8">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/4" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{error ? String(error) : _(msg`Entry not found`)}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <EntryReadingHeader
        entry={entry}
        onNavigatePrev={onNavigatePrev}
        onNavigateNext={onNavigateNext}
        onClose={onClose}
        hasPrev={hasPrev}
        hasNext={hasNext}
        hideNavigation={hideNavigation}
        onToggleStar={() => toggleStar.mutate(entry.id)}
        isStarred={entry.starred ?? false}
        onToggleRead={() => toggleEntryRead.mutate(entry.id)}
        onOpenInAppBrowser={onOpenInAppBrowser}
        isRead={entry.status === 'read'}
        isTogglingRead={toggleEntryRead.isPending}
        headerPadding={headerPadding}
        smallTitleOpacity={smallTitleOpacity}
        smallTitleHeight={smallTitleHeight}
        titleOpacity={titleOpacity}
        titleScale={titleScale}
        titleY={titleY}
        titleMaxHeight={titleMaxHeight}
        translationEnabled={translationEnabled}
        onTranslationEnabledChange={handleTranslationEnabledChange}
        translationDisplayMode={translationDisplayMode}
        onTranslationDisplayModeChange={setTranslationDisplayMode}
        translationTargetLanguage={translationTargetLanguage}
        onTranslationTargetLanguageChange={setTranslationTargetLanguage}
        activeTranslationProvider={activeTranslationProvider}
        isExcludedFeed={isExcludedFeed}
        onFetchOriginalContent={handleFetchOriginalContent}
        isFetchingOriginalContent={fetchEntryContent.isPending}
        isOriginalContentDownloaded={isOriginalContentDownloaded}
        onSummarize={articleSummary.handleSummarize}
        isSummarizing={articleSummary.loading}
        hasSummary={!!articleSummary.summary}
        focusMode={focusMode}
        onFocusModeChange={setFocusMode}
      />

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <ReaderSelectionToolbar
          containerRef={scrollViewportRef}
          translationPreferences={translationPreferences}
          sourceLanguage={null}
        />
        <motion.div
          className="h-full"
          style={{
            x: swipeContentX,
            y: pullContentY,
            scale: contentScale,
            overflow: 'hidden',
            willChange: 'transform',
          }}
        >
          <ContextMenu>
            <ContextMenuTrigger className="h-full">
              <ScrollArea className="h-full min-h-0" ref={scrollRef}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${entry.id}:${contentRevision}`}
                    initial={{
                      opacity: articleEnterOpacity,
                      y: directionalEnterY,
                      filter: 'blur(0.8px)',
                    }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{
                      opacity: articleExitOpacity,
                      y: directionalExitY,
                      filter: 'blur(0.8px)',
                      transition: articleExitTransition,
                    }}
                    transition={articleEnterTransition}
                    className="px-4 py-8 transition-colors duration-300 sm:px-6 sm:py-10 lg:px-10 xl:pr-24"
                    style={readerSurfaceStyle}
                  >
                    <ArticleSummaryCard
                      summary={articleSummary.summary}
                      loading={articleSummary.loading}
                      error={articleSummary.error}
                      modelUsed={articleSummary.modelUsed}
                      providerUsed={articleSummary.providerUsed}
                      collapsed={articleSummary.collapsed}
                      onToggleCollapse={articleSummary.onToggleCollapse}
                      onRetry={articleSummary.handleSummarize}
                    />
                    {entry.content ? (
                      <ImmersiveTranslationLayer
                        entryId={entry.id}
                        html={readingContent.html}
                        translationEnabled={translationEnabled}
                        translationDisplayMode={translationDisplayMode}
                        translateRequestToken={translateRequestToken}
                        translationPreferences={translationPreferences}
                        providerSettings={translationProviderSettings}
                        bionicEnglish={bionicReading}
                        chineseConversionMode={chineseConversionMode}
                        customConversionRules={customConversionRules}
                        codeTheme={codeTheme}
                        onActiveProviderChange={setActiveTranslationProvider}
                        onTranslationProgressChange={(completed, total) =>
                          setTranslationProgress({ completed, total })
                        }
                        className={cn(
                          'mx-auto max-w-none break-words prose prose-slate transition-all duration-300 dark:prose-invert',
                          useInvertedProse && 'prose-invert',
                          '[&_h1]:mb-5 [&_h1]:text-3xl [&_h1]:leading-tight [&_h1]:font-semibold',
                          '[&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:leading-snug [&_h2]:font-semibold',
                          '[&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:leading-snug [&_h3]:font-semibold',
                          '[&_p]:my-5 [&_p]:tracking-[0.01em]',
                          '[&_ul]:my-5 [&_ol]:my-5 [&_li]:my-1.5',
                          '[&_a]:break-all [&_a]:underline [&_a]:decoration-[color:var(--reader-link)] [&_a]:underline-offset-4',
                          '[&_blockquote]:my-8 [&_blockquote]:rounded-r-xl [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:bg-primary/5 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:text-foreground/90',
                          '[&_hr]:my-8 [&_hr]:border-border/60',
                          '[&_table]:text-sm [&_table]:leading-relaxed',
                          '[&_img]:my-8',
                          '[&_p:first-child]:mt-0 [&>*:last-child]:mb-0',
                          focusMode &&
                            '[&_[data-reader-node]]:opacity-25 [&_[data-reader-node]]:transition-opacity [&_[data-reader-node]]:duration-300 [&_[data-reader-node][data-focused="true"]]:opacity-100'
                        )}
                        style={readerProseStyle}
                      />
                    ) : (
                      <p className="text-muted-foreground italic text-center py-20">
                        {_(msg`No content available`)}
                      </p>
                    )}
                  </motion.div>
                </AnimatePresence>
              </ScrollArea>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-64">
              {/* Quick actions toolbar */}
              <div className="flex items-center gap-1 px-1.5 py-1">
                <button
                  type="button"
                  disabled={!hasPrev || !onNavigatePrev}
                  onClick={onNavigatePrev}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/10 hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-30"
                  title={_(msg`Previous Article`)}
                >
                  <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={!hasNext || !onNavigateNext}
                  onClick={onNavigateNext}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/10 hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-30"
                  title={_(msg`Next Article`)}
                >
                  <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-4" />
                </button>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleStar.mutate(entry.id)}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-md hover:bg-black/[0.06] dark:hover:bg-white/10 hover:text-accent-foreground',
                      entry.starred ? 'text-yellow-500' : 'text-muted-foreground'
                    )}
                    title={entry.starred ? _(msg`Unstar`) : _(msg`Star`)}
                  >
                    <HugeiconsIcon icon={StarIcon} strokeWidth={2} className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const viewport = scrollRef.current?.querySelector<HTMLElement>(
                        '[data-slot="scroll-area-viewport"]'
                      );
                      if (viewport) animateViewportScrollTo(viewport, 0);
                    }}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/10 hover:text-accent-foreground"
                    title={_(msg`Go to Top`)}
                  >
                    <HugeiconsIcon icon={ArrowTurnUpIcon} strokeWidth={2} className="size-4" />
                  </button>
                </div>
              </div>

              <ContextMenuSeparator />

              <ContextMenuGroup>
                <ContextMenuLabel>{_(msg`AI`)}</ContextMenuLabel>
                <ContextMenuItem
                  onClick={articleSummary.handleSummarize}
                  disabled={articleSummary.loading}
                >
                  <HugeiconsIcon
                    icon={SparklesIcon}
                    strokeWidth={2}
                    className="size-4 text-muted-foreground"
                  />
                  {articleSummary.summary ? _(msg`Re-summarize`) : _(msg`Summarize Article`)}
                  <ContextMenuShortcut>
                    {formatShortcutDisplay(shortcuts.summarize)}
                  </ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuGroup>

              <ContextMenuSeparator />

              <ContextMenuGroup>
                <ContextMenuLabel>{_(msg`Translation`)}</ContextMenuLabel>
                <ContextMenuItem
                  onClick={() => handleTranslationEnabledChange(!translationEnabled)}
                >
                  <HugeiconsIcon
                    icon={Globe02Icon}
                    strokeWidth={2}
                    className="size-4 text-muted-foreground"
                  />
                  {_(msg`Translate Article`)}
                  <ContextMenuShortcut>
                    {formatShortcutDisplay(shortcuts['toggle-translation'])}
                  </ContextMenuShortcut>
                </ContextMenuItem>
                {entry.feed &&
                  (() => {
                    const isFeedExcluded = translationExcludedFeedIds.includes(entry.feed_id);
                    return (
                      <ContextMenuItem
                        onClick={() => {
                          const next = isFeedExcluded
                            ? translationExcludedFeedIds.filter((id) => id !== entry.feed_id)
                            : [...translationExcludedFeedIds, entry.feed_id];
                          setTranslationExcludedFeedIds(next);
                          if (isFeedExcluded) {
                            showToast.success(
                              _(msg`Feed translation re-enabled`),
                              entry.feed.title
                            );
                          } else {
                            showToast.info(
                              _(msg`Feed excluded from translation`),
                              entry.feed.title
                            );
                          }
                        }}
                      >
                        <HugeiconsIcon
                          icon={ViewOffIcon}
                          strokeWidth={2}
                          className="size-4 text-muted-foreground"
                        />
                        {_(msg`Skip this feed`)}
                        <span
                          className={cn(
                            'ml-auto size-2 rounded-full shrink-0 transition-colors',
                            isFeedExcluded ? 'bg-primary' : 'border border-muted-foreground/40'
                          )}
                        />
                      </ContextMenuItem>
                    );
                  })()}
                {entry.feed.category &&
                  (() => {
                    const isCategoryExcluded = translationExcludedCategoryIds.includes(
                      entry.feed.category.id
                    );
                    return (
                      <ContextMenuItem
                        onClick={() => {
                          const categoryId = entry.feed.category?.id;
                          if (!categoryId) return;
                          const next = isCategoryExcluded
                            ? translationExcludedCategoryIds.filter((id) => id !== categoryId)
                            : [...translationExcludedCategoryIds, categoryId];
                          setTranslationExcludedCategoryIds(next);
                          if (isCategoryExcluded) {
                            showToast.success(
                              _(msg`Category translation re-enabled`),
                              entry.feed.category?.title
                            );
                          } else {
                            showToast.info(
                              _(msg`Category excluded from translation`),
                              entry.feed.category?.title
                            );
                          }
                        }}
                      >
                        <HugeiconsIcon
                          icon={ViewOffIcon}
                          strokeWidth={2}
                          className="size-4 text-muted-foreground"
                        />
                        {_(msg`Skip this category`)}
                        <span
                          className={cn(
                            'ml-auto size-2 rounded-full shrink-0 transition-colors',
                            isCategoryExcluded ? 'bg-primary' : 'border border-muted-foreground/40'
                          )}
                        />
                      </ContextMenuItem>
                    );
                  })()}
              </ContextMenuGroup>

              <ContextMenuSeparator />

              <ContextMenuGroup>
                <ContextMenuLabel>{_(msg`Article`)}</ContextMenuLabel>
                <ContextMenuItem onClick={() => toggleEntryRead.mutate(entry.id)}>
                  <HugeiconsIcon
                    icon={entry.status === 'read' ? Mail01Icon : MailOpen01Icon}
                    strokeWidth={2}
                    className="size-4 text-muted-foreground"
                  />
                  {entry.status === 'read' ? _(msg`Mark as unread`) : _(msg`Mark as read`)}
                  <ContextMenuShortcut>
                    {formatShortcutDisplay(shortcuts['toggle-read'])}
                  </ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={handleFetchOriginalContent}>
                  <HugeiconsIcon
                    icon={Download01Icon}
                    strokeWidth={2}
                    className="size-4 text-muted-foreground"
                  />
                  {_(msg`Fetch Original Content`)}
                  <ContextMenuShortcut>
                    {formatShortcutDisplay(shortcuts['fetch-content'])}
                  </ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => setFocusMode(!focusMode)}>
                  <HugeiconsIcon
                    icon={ViewIcon}
                    strokeWidth={2}
                    className="size-4 text-muted-foreground"
                  />
                  {_(msg`Focus Mode`)}
                  <span
                    className={cn(
                      'size-2 rounded-full shrink-0 transition-colors',
                      focusMode ? 'bg-primary' : 'border border-muted-foreground/40'
                    )}
                  />
                  <ContextMenuShortcut>
                    {formatShortcutDisplay(shortcuts['toggle-focus-mode'])}
                  </ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuGroup>

              {entry.url && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuGroup>
                    <ContextMenuLabel>{_(msg`Links`)}</ContextMenuLabel>
                    <ContextMenuItem
                      onClick={() => window.open(entry.url, '_blank', 'noopener,noreferrer')}
                    >
                      <HugeiconsIcon
                        icon={Link01Icon}
                        strokeWidth={2}
                        className="size-4 text-muted-foreground"
                      />
                      {_(msg`Open in Browser`)}
                      <ContextMenuShortcut>
                        {formatShortcutDisplay(shortcuts['open-browser'])}
                      </ContextMenuShortcut>
                    </ContextMenuItem>
                    {onOpenInAppBrowser && (
                      <ContextMenuItem onClick={() => onOpenInAppBrowser(entry.url)}>
                        <HugeiconsIcon
                          icon={ViewIcon}
                          strokeWidth={2}
                          className="size-4 text-muted-foreground"
                        />
                        {_(msg`Open in App Browser`)}
                        <ContextMenuShortcut>
                          {formatShortcutDisplay(shortcuts['open-app-browser'])}
                        </ContextMenuShortcut>
                      </ContextMenuItem>
                    )}
                    <ContextMenuItem onClick={() => navigator.clipboard.writeText(entry.url)}>
                      <HugeiconsIcon
                        icon={Copy01Icon}
                        strokeWidth={2}
                        className="size-4 text-muted-foreground"
                      />
                      {_(msg`Copy Link`)}
                      <ContextMenuShortcut>
                        {formatShortcutDisplay(shortcuts['copy-link'])}
                      </ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={handleSaveToServices}>
                      <HugeiconsIcon
                        icon={SentIcon}
                        strokeWidth={2}
                        className="size-4 text-muted-foreground"
                      />
                      {_(msg`Save to services`)}
                    </ContextMenuItem>
                  </ContextMenuGroup>
                </>
              )}

              {getPodcastEnclosure(entry) && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuGroup>
                    <ContextMenuLabel>{_(msg`Podcast`)}</ContextMenuLabel>
                    <ContextMenuItem
                      onClick={() =>
                        document.dispatchEvent(new CustomEvent('command:podcast-play-pause'))
                      }
                    >
                      <HugeiconsIcon
                        icon={PlayIcon}
                        strokeWidth={2}
                        className="size-4 text-muted-foreground"
                      />
                      {_(msg`Play / Pause`)}
                      <ContextMenuShortcut>
                        {formatShortcutDisplay(shortcuts['podcast-play'])}
                      </ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() =>
                        document.dispatchEvent(new CustomEvent('command:podcast-add-to-playlist'))
                      }
                    >
                      <HugeiconsIcon
                        icon={Playlist03Icon}
                        strokeWidth={2}
                        className="size-4 text-muted-foreground"
                      />
                      {_(msg`Add to Playlist`)}
                      <ContextMenuShortcut>
                        {formatShortcutDisplay(shortcuts['podcast-queue'])}
                      </ContextMenuShortcut>
                    </ContextMenuItem>
                  </ContextMenuGroup>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        </motion.div>

        <AnimatePresence>
          {showToc && (
            <motion.aside
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="pointer-events-none absolute top-1/2 right-5 z-20 hidden -translate-y-1/2 xl:flex"
            >
              <fieldset
                className="group/toc pointer-events-auto relative m-0 flex min-w-0 items-center gap-4 border-0 p-0"
                onMouseLeave={() => setHoveredHeadingId(null)}
              >
                <legend className="sr-only">{tocGroupLabel}</legend>
                <AnimatePresence>
                  {hoveredTocItem && (
                    <motion.div
                      initial={{ opacity: 0, x: 16, scale: 0.94, filter: 'blur(6px)' }}
                      animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, x: 14, scale: 0.96, filter: 'blur(4px)' }}
                      transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.7 }}
                      data-glass
                      className="pointer-events-none w-80 rounded-4xl border border-border/50 bg-background/85 px-5 py-4 shadow-lg backdrop-blur-xl"
                    >
                      <p className="line-clamp-1 text-lg text-muted-foreground">
                        {hoveredTocItem.text}
                      </p>
                      {hoveredTocItem.preview && (
                        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-foreground/85">
                          {hoveredTocItem.preview}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col items-end gap-3">
                  <motion.button
                    type="button"
                    onClick={() => handleJumpBySection(-1)}
                    disabled={!canJumpPrev}
                    aria-label={previousSectionLabel}
                    whileHover={canJumpPrev ? { scale: 1.08, y: -1 } : undefined}
                    whileTap={canJumpPrev ? { scale: 0.92 } : undefined}
                    className={cn(
                      'grid h-7 w-7 place-items-center rounded-full border border-transparent bg-background/30 text-muted-foreground transition-[opacity,transform,color,background-color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                      'opacity-0 translate-x-1 group-hover/toc:translate-x-0 group-hover/toc:opacity-100 focus-visible:translate-x-0 focus-visible:opacity-100',
                      canJumpPrev &&
                        'hover:border-border/50 hover:bg-background/70 hover:text-foreground',
                      !canJumpPrev && 'pointer-events-none opacity-0'
                    )}
                  >
                    <motion.span whileHover={canJumpPrev ? { y: -1 } : undefined}>
                      <HugeiconsIcon icon={ArrowUp01Icon} className="size-4" />
                    </motion.span>
                  </motion.button>

                  <ul className="space-y-3">
                    {readingContent.tocItems.map((item, index) => {
                      const isActive = item.id === activeHeadingId;
                      const barWidth = getTocBarWidth(item.sectionLength);

                      return (
                        <motion.li
                          key={item.id}
                          initial={{ opacity: 0, x: 6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.16, delay: Math.min(index * 0.03, 0.16) }}
                          className="flex justify-end"
                        >
                          <motion.button
                            type="button"
                            onClick={() => handleTocNavigation(item.id)}
                            onMouseEnter={() => setHoveredHeadingId(item.id)}
                            onFocus={() => setHoveredHeadingId(item.id)}
                            onBlur={() => setHoveredHeadingId(null)}
                            aria-current={isActive ? 'true' : undefined}
                            aria-label={item.text}
                            whileHover={{ x: -2, scaleX: 1.06 }}
                            whileTap={{ scaleX: 0.96 }}
                            className={cn(
                              'group relative flex h-3 items-center justify-end rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                              isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                            )}
                            style={{ width: `${barWidth}px` }}
                          >
                            <motion.span
                              className={cn(
                                'block h-[2px] w-full rounded-full transition-all',
                                isActive
                                  ? 'bg-foreground shadow-[0_0_12px_hsl(var(--foreground)/0.35)]'
                                  : 'bg-muted-foreground/70 group-hover/toc:bg-muted-foreground'
                              )}
                              animate={isActive ? { scaleX: 1.08 } : { scaleX: 1 }}
                              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                            />
                          </motion.button>
                        </motion.li>
                      );
                    })}
                  </ul>

                  <motion.button
                    type="button"
                    onClick={() => handleJumpBySection(1)}
                    disabled={!canJumpNext}
                    aria-label={nextSectionLabel}
                    whileHover={canJumpNext ? { scale: 1.08, y: 1 } : undefined}
                    whileTap={canJumpNext ? { scale: 0.92 } : undefined}
                    className={cn(
                      'grid h-7 w-7 place-items-center rounded-full border border-transparent bg-background/30 text-muted-foreground transition-[opacity,transform,color,background-color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                      'opacity-0 translate-x-1 group-hover/toc:translate-x-0 group-hover/toc:opacity-100 focus-visible:translate-x-0 focus-visible:opacity-100',
                      canJumpNext &&
                        'hover:border-border/50 hover:bg-background/70 hover:text-foreground',
                      !canJumpNext && 'pointer-events-none opacity-0'
                    )}
                  >
                    <motion.span whileHover={canJumpNext ? { y: 1 } : undefined}>
                      <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
                    </motion.span>
                  </motion.button>
                </div>
              </fieldset>
            </motion.aside>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {readingProgress > 8 &&
            !(isAtBottom && hasNext && nextEntryTitle) &&
            !pullBottomHintVisible && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute right-4 bottom-4 z-20"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={floatingToolbarButtonClass}
                  aria-label={scrollToTopLabel}
                  onClick={handleScrollToTop}
                >
                  <HugeiconsIcon icon={ArrowUp01Icon} className="h-4 w-4" strokeWidth={2} />
                </Button>
              </motion.div>
            )}
        </AnimatePresence>

        <AnimatePresence>
          {isAtBottom && hasNext && nextEntryTitle && !pullBottomHintVisible && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-4 bottom-4 left-4 z-20 flex justify-center"
            >
              <button
                type="button"
                onClick={() => onNavigateNext?.()}
                className="group/next flex max-w-xs items-center gap-2.5 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 shadow-lg backdrop-blur-xl transition-all duration-200 hover:border-white/20 hover:bg-white/15 hover:shadow-xl active:scale-[0.98]"
              >
                <span className="truncate text-sm font-medium text-foreground/90">
                  {nextEntryTitle}
                </span>
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 transition-transform duration-200 group-hover/next:translate-x-0.5">
                  <HugeiconsIcon icon={ArrowRightIcon} className="size-3 text-foreground/70" />
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {swipeLeftHintVisible &&
            (() => {
              const action = getGestureAction(swipeLeftAction);
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="pointer-events-none absolute inset-y-0 right-0 z-30 flex items-center"
                >
                  <motion.div
                    className="flex items-center gap-2 rounded-l-2xl px-4 py-2.5"
                    style={{
                      x: swipeLeftHintX,
                      opacity: swipeLeftHintOpacity,
                      scale: swipeLeftHintScale,
                    }}
                  >
                    {action?.icon && (
                      <motion.div
                        style={{ scale: swipeLeftIconScale, rotate: swipeLeftIconRotate }}
                      >
                        <HugeiconsIcon
                          icon={action.icon}
                          className="h-4 w-4 text-muted-foreground"
                          strokeWidth={2}
                        />
                      </motion.div>
                    )}
                    <motion.span
                      className="whitespace-nowrap text-xs font-medium text-muted-foreground"
                      style={{ opacity: swipeLeftLabelOpacity, x: swipeLeftLabelX }}
                    >
                      {action ? _(action.label) : ''}
                    </motion.span>
                  </motion.div>
                </motion.div>
              );
            })()}
        </AnimatePresence>

        <AnimatePresence>
          {swipeRightHintVisible &&
            swipeRightAction !== 'close_browser' &&
            (() => {
              const action = getGestureAction(swipeRightAction);
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="pointer-events-none absolute inset-y-0 left-0 z-30 flex items-center"
                >
                  <motion.div
                    className="flex items-center gap-2 rounded-r-2xl px-4 py-2.5"
                    style={{
                      x: swipeRightHintX,
                      opacity: swipeRightHintOpacity,
                      scale: swipeRightHintScale,
                    }}
                  >
                    {action?.icon && (
                      <motion.div
                        style={{ scale: swipeRightIconScale, rotate: swipeRightIconRotate }}
                      >
                        <HugeiconsIcon
                          icon={action.icon}
                          className="h-4 w-4 text-muted-foreground"
                          strokeWidth={2}
                        />
                      </motion.div>
                    )}
                    <motion.span
                      className="whitespace-nowrap text-xs font-medium text-muted-foreground"
                      style={{ opacity: swipeRightLabelOpacity, x: swipeRightLabelX }}
                    >
                      {action ? _(action.label) : ''}
                    </motion.span>
                  </motion.div>
                </motion.div>
              );
            })()}
        </AnimatePresence>

        <AnimatePresence>
          {pullTopHintVisible &&
            (() => {
              const action = getGestureAction(pullTopAction);
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center"
                >
                  <motion.div
                    className="flex w-full items-center justify-center gap-2 rounded-b-2xl px-4 py-3"
                    style={{
                      y: pullTopHintY,
                      opacity: pullTopHintOpacity,
                      scale: pullTopHintScale,
                    }}
                  >
                    {action?.icon && (
                      <motion.div style={{ scale: pullTopIconScale, rotate: pullTopIconRotate }}>
                        <HugeiconsIcon
                          icon={action.icon}
                          className="h-4 w-4 text-muted-foreground"
                          strokeWidth={2}
                        />
                      </motion.div>
                    )}
                    <motion.span
                      className="text-xs font-medium text-muted-foreground"
                      style={{ opacity: pullTopLabelOpacity, y: pullTopLabelY }}
                    >
                      {action ? _(action.label) : ''}
                    </motion.span>
                  </motion.div>
                </motion.div>
              );
            })()}
        </AnimatePresence>

        <AnimatePresence>
          {pullBottomHintVisible &&
            (() => {
              const action = getGestureAction(pullBottomAction);
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center"
                >
                  <motion.div
                    className="flex w-full items-center justify-center gap-2 rounded-t-2xl px-4 py-3"
                    style={{
                      y: pullBottomHintY,
                      opacity: pullBottomHintOpacity,
                      scale: pullBottomHintScale,
                    }}
                  >
                    {action?.icon && (
                      <motion.div
                        style={{ scale: pullBottomIconScale, rotate: pullBottomIconRotate }}
                      >
                        <HugeiconsIcon
                          icon={action.icon}
                          className="h-4 w-4 text-muted-foreground"
                          strokeWidth={2}
                        />
                      </motion.div>
                    )}
                    <motion.span
                      className="text-xs font-medium text-muted-foreground"
                      style={{ opacity: pullBottomLabelOpacity, y: pullBottomLabelY }}
                    >
                      {action ? _(action.label) : ''}
                    </motion.span>
                  </motion.div>
                </motion.div>
              );
            })()}
        </AnimatePresence>

        {translationEnabled && (
          <div className="pointer-events-none absolute bottom-14 left-2 z-30">
            <TranslationProgressRing
              completed={translationProgress.completed}
              total={translationProgress.total}
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          {statusBarVisible ? (
            <motion.footer
              key="reading-status"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="pointer-events-none absolute bottom-2 left-2 z-20"
            >
              <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-popover/75 px-2 py-1 text-[10px] leading-none text-muted-foreground ring-1 ring-foreground/10 shadow-lg backdrop-blur-2xl backdrop-saturate-150">
                <span className="font-medium tracking-wide">{progressLabel}</span>
                <span aria-hidden className="opacity-50">
                  •
                </span>
                <span>{minutesLeftLabel}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-sm border border-transparent text-muted-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.12] hover:text-muted-foreground focus-visible:text-muted-foreground active:text-muted-foreground aria-expanded:text-muted-foreground"
                  aria-label={hideReadingStatusLabel}
                  onClick={() => setStatusBarVisible(false)}
                >
                  <HugeiconsIcon icon={ViewOffIcon} className="h-3.5 w-3.5" strokeWidth={2} />
                </Button>
              </div>
            </motion.footer>
          ) : (
            <motion.div
              key="reading-status-toggle"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute bottom-2 left-2 z-20"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={floatingToolbarButtonClass}
                aria-label={showReadingStatusLabel}
                onClick={() => setStatusBarVisible(true)}
              >
                <HugeiconsIcon icon={ViewIcon} className="h-4 w-4" strokeWidth={2} />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
