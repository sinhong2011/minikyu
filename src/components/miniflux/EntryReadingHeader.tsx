import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Cancel01Icon,
  CenterFocusIcon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Download01Icon,
  Globe02Icon,
  Mail01Icon,
  MailOpen01Icon,
  PauseIcon,
  PlayIcon,
  Playlist03Icon,
  SentIcon,
  Share01Icon,
  SparklesIcon,
  StarIcon,
  TextIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { parseISO } from 'date-fns';
import { AnimatePresence, type MotionValue, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/animate-ui/components/base/switch';
import { FeedAvatar } from '@/components/miniflux/FeedAvatar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipPanel, TooltipTrigger } from '@/components/ui/tooltip';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import type { Entry } from '@/lib/bindings';
import { convertChineseText, normalizeCustomConversionRules } from '@/lib/chinese-conversion';
import { formatShortDate } from '@/lib/miniflux-utils';
import { getPodcastEnclosure } from '@/lib/podcast-utils';
import { normalizeReaderTheme, type ReaderTheme, readerThemeOptions } from '@/lib/reader-theme';
import { type ReaderCodeTheme, readerCodeThemeOptions } from '@/lib/shiki-highlight';
import type { AppPreferences, ChineseConversionMode } from '@/lib/tauri-bindings';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/store/player-store';
import { ReaderSettings } from './ReaderSettings';

interface EntryReadingHeaderProps {
  entry: Entry;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  hideNavigation?: boolean;
  onToggleStar: () => void;
  isStarred: boolean;
  onToggleRead: () => void;
  onFetchOriginalContent?: () => void;
  onShare?: () => void;
  onClose?: () => void;
  onOpenInAppBrowser?: (url: string) => void;
  isRead: boolean;
  isTogglingRead: boolean;
  isFetchingOriginalContent?: boolean;
  isOriginalContentDownloaded?: boolean;
  headerPadding: MotionValue<number>;
  smallTitleOpacity: MotionValue<number>;
  smallTitleHeight: MotionValue<number>;
  titleOpacity: MotionValue<number>;
  titleScale: MotionValue<number>;
  titleY: MotionValue<number>;
  titleMaxHeight: MotionValue<number>;
  translationEnabled: boolean;
  onTranslationEnabledChange: (enabled: boolean) => void;
  translationDisplayMode: AppPreferences['reader_translation_display_mode'];
  onTranslationDisplayModeChange: (mode: AppPreferences['reader_translation_display_mode']) => void;
  translationTargetLanguage: AppPreferences['reader_translation_target_language'];
  onTranslationTargetLanguageChange: (
    language: AppPreferences['reader_translation_target_language']
  ) => void;
  activeTranslationProvider: string | null;
  isExcludedFeed: boolean;
  onSummarize: () => void;
  isSummarizing: boolean;
  hasSummary: boolean;
  focusMode: boolean;
  onFocusModeChange: (enabled: boolean) => void;
}

export function EntryReadingHeader({
  entry,
  onNavigatePrev,
  onNavigateNext,
  hasPrev,
  hasNext,
  hideNavigation = false,
  onToggleStar,
  isStarred,
  onToggleRead,
  onFetchOriginalContent,
  onShare,
  onClose,
  onOpenInAppBrowser,
  isRead,
  isTogglingRead,
  isFetchingOriginalContent,
  isOriginalContentDownloaded,
  headerPadding,
  smallTitleOpacity,
  smallTitleHeight,
  titleOpacity,
  titleScale,
  titleY,
  titleMaxHeight,
  translationEnabled,
  onTranslationEnabledChange,
  translationDisplayMode,
  onTranslationDisplayModeChange,
  translationTargetLanguage,
  onTranslationTargetLanguageChange,
  activeTranslationProvider,
  isExcludedFeed,
  onSummarize,
  isSummarizing,
  hasSummary,
  focusMode,
  onFocusModeChange,
}: EntryReadingHeaderProps) {
  const { _, i18n } = useLingui();
  const {
    chineseConversionMode,
    customConversionRules,
    bionicReading,
    codeTheme,
    readerTheme,
    statusBarVisible,
    setChineseConversionMode,
    setBionicReading,
    setCodeTheme,
    setReaderTheme,
    setStatusBarVisible,
    isLoading,
  } = useReaderSettings();
  const selectedReaderTheme = normalizeReaderTheme(readerTheme);

  const [convertedTitle, setConvertedTitle] = useState(entry.title);
  const normalizedRules = useMemo(
    () => normalizeCustomConversionRules(customConversionRules),
    [customConversionRules]
  );
  useEffect(() => {
    if (chineseConversionMode === 'off' && normalizedRules.length === 0) {
      setConvertedTitle(entry.title);
      return;
    }
    convertChineseText(entry.title, chineseConversionMode, normalizedRules).then(setConvertedTitle);
  }, [entry.title, chineseConversionMode, normalizedRules]);

  const conversionOptions: Array<{
    value: ChineseConversionMode;
    label: string;
  }> = [
    { value: 'off', label: _(msg`Off`) },
    { value: 's2hk', label: _(msg`繁體中文（香港）`) },
    { value: 's2tw', label: _(msg`繁體中文（台灣）`) },
    { value: 't2s', label: _(msg`簡體中文`) },
  ];
  const translationTargetLanguageOptions = [
    { value: 'en', label: _(msg`English`) },
    { value: 'zh-CN', label: _(msg`Chinese (Simplified)`) },
    { value: 'zh-TW', label: _(msg`Chinese (Traditional)`) },
    { value: 'ja', label: _(msg`Japanese`) },
    { value: 'ko', label: _(msg`Korean`) },
    { value: 'es', label: _(msg`Spanish`) },
    { value: 'fr', label: _(msg`French`) },
    { value: 'de', label: _(msg`German`) },
  ] as const;

  const formatCodeThemeLabel = (theme: ReaderCodeTheme) => {
    if (theme === 'auto') {
      return _(msg`Auto`);
    }

    return theme
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };
  const getReaderThemeLabel = (theme: ReaderTheme) => {
    switch (theme) {
      case 'default':
        return _(msg`Default`);
      case 'paper':
        return _(msg`Paper`);
      case 'sepia':
        return _(msg`Sepia`);
      case 'slate':
        return _(msg`Slate`);
      case 'oled':
        return _(msg`OLED`);
      default:
        return _(msg`Default`);
    }
  };
  const getTranslationProviderLabel = (provider: string) => {
    if (provider === 'apple_built_in') {
      return _(msg`Apple Built-in`);
    }

    return provider
      .split('_')
      .filter((part) => part.length > 0)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };
  const toolbarButtonClass =
    'h-9 w-9 rounded-xl border border-transparent text-muted-foreground/90 hover:bg-accent/70 hover:text-foreground data-[state=open]:border-border/60 data-[state=open]:bg-accent/70 data-[state=open]:text-foreground';
  const translationControlActive = translationEnabled;
  const currentPlayerEntryId = usePlayerStore((state) => state.currentEntry?.id ?? null);
  const playerIsPlaying = usePlayerStore((state) => state.isPlaying);
  const playerIsBuffering = usePlayerStore((state) => state.isBuffering);
  const podcastEnclosure = useMemo(() => getPodcastEnclosure(entry), [entry]);
  const isCurrentPodcastEntry = currentPlayerEntryId === entry.id;
  const podcastPlaying = isCurrentPodcastEntry && playerIsPlaying;
  const podcastBuffering = isCurrentPodcastEntry && playerIsBuffering;

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedShareCode, setCopiedShareCode] = useState(false);
  const [savedToServices, setSavedToServices] = useState(false);
  const [isSavingToServices, setIsSavingToServices] = useState(false);

  const handleCopyUrl = async () => {
    await writeText(entry.url);
    setCopiedUrl(true);
    onShare?.();
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyShareCode = async () => {
    if (entry.share_code) {
      const shareUrl = `${entry.feed.site_url}/share/${entry.share_code}`;
      await writeText(shareUrl);
      setCopiedShareCode(true);
      setTimeout(() => setCopiedShareCode(false), 2000);
    }
  };

  const handleOpenInBrowser = () => {
    window.open(entry.url, '_blank', 'noopener,noreferrer');
  };

  const handleSaveToServices = async () => {
    setIsSavingToServices(true);
    try {
      const result = await commands.saveEntry(entry.id);
      if (result.status === 'error') {
        toast.error(_(msg`Failed to save entry`), { description: result.error });
        return;
      }
      setSavedToServices(true);
      toast.success(_(msg`Entry sent to services`));
      setTimeout(() => setSavedToServices(false), 2000);
    } catch (error) {
      toast.error(_(msg`Failed to save entry`), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSavingToServices(false);
    }
  };
  const fetchOriginalContentLabel = _(msg`Download original content`);
  const fetchingOriginalContentLabel = _(msg`Fetching original content...`);
  const originalContentDownloadedLabel = _(msg`Original content downloaded`);
  const podcastPlayLabel = podcastBuffering
    ? _(msg`Loading...`)
    : podcastPlaying
      ? _(msg`Pause`)
      : _(msg`Play`);

  const handlePodcastPlayPause = () => {
    if (!podcastEnclosure) return;

    const { currentEntry, isPlaying, pause, play, resume } = usePlayerStore.getState();

    if (currentEntry?.id === entry.id) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
      return;
    }

    play(entry, podcastEnclosure);
  };

  const handleAddToPlaylist = () => {
    if (!podcastEnclosure) return;
    usePlayerStore.getState().addToQueue(entry, podcastEnclosure);
    toast.message(_(msg`Added to playlist`), { description: entry.title });
  };

  useEffect(() => {
    const onPlayPause = () => handlePodcastPlayPause();
    const onAddToPlaylist = () => handleAddToPlaylist();
    document.addEventListener('command:podcast-play-pause', onPlayPause);
    document.addEventListener('command:podcast-add-to-playlist', onAddToPlaylist);
    return () => {
      document.removeEventListener('command:podcast-play-pause', onPlayPause);
      document.removeEventListener('command:podcast-add-to-playlist', onAddToPlaylist);
    };
  });

  return (
    <motion.header
      className="sticky top-0 z-10 w-full min-w-0 max-w-full shrink-0 bg-gradient-to-b from-background/75 via-background/58 to-background/45 shadow-[0_10px_28px_-24px_hsl(var(--foreground)/0.65)] supports-[backdrop-filter]:bg-background/35 backdrop-blur-2xl"
      style={{
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: headerPadding,
        paddingBottom: headerPadding,
        // biome-ignore lint/style/useNamingConvention: CSS property
        WebkitBackdropFilter: 'blur(24px)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div className="flex flex-col gap-3">
        <div
          className="flex w-full items-center justify-between gap-1.5 rounded-2xl bg-background/65 px-1.5 py-1 shadow-sm supports-[backdrop-filter]:bg-background/50"
          role="toolbar"
        >
          <div className="flex items-center gap-1.5">
            {onClose && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={toolbarButtonClass}
                      onClick={onClose}
                      aria-label={_(msg`Close`)}
                    />
                  }
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5" strokeWidth={2} />
                </TooltipTrigger>
                <TooltipPanel>{_(msg`Close`)}</TooltipPanel>
              </Tooltip>
            )}

            {!hideNavigation && (
              <>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={toolbarButtonClass}
                        onClick={onNavigatePrev}
                        disabled={!hasPrev}
                        aria-label={_(msg`Previous entry (h or ←)`)}
                      />
                    }
                  >
                    <HugeiconsIcon icon={ArrowLeft02Icon} className="h-5 w-5" strokeWidth={2} />
                  </TooltipTrigger>
                  <TooltipPanel>{_(msg`Previous entry (h or ←)`)}</TooltipPanel>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={toolbarButtonClass}
                        onClick={onNavigateNext}
                        disabled={!hasNext}
                        aria-label={_(msg`Next entry (j or →)`)}
                      />
                    }
                  >
                    <HugeiconsIcon icon={ArrowRight02Icon} className="h-5 w-5" strokeWidth={2} />
                  </TooltipTrigger>
                  <TooltipPanel>{_(msg`Next entry (j or →)`)}</TooltipPanel>
                </Tooltip>
              </>
            )}

            {podcastEnclosure && (
              <>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(toolbarButtonClass, 'relative')}
                        onClick={handlePodcastPlayPause}
                        aria-label={podcastPlayLabel}
                        data-testid="entry-header-podcast-play"
                      />
                    }
                  >
                    <span className="relative inline-flex">
                      {podcastBuffering && (
                        <motion.span
                          aria-hidden
                          className="pointer-events-none absolute -inset-1 rounded-full border border-primary/35"
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1.1,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: 'linear',
                          }}
                        />
                      )}
                      {podcastPlaying && !podcastBuffering && (
                        <motion.span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 rounded-full bg-primary/20"
                          animate={{ scale: [1, 1.32], opacity: [0.45, 0] }}
                          transition={{
                            duration: 1.15,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: 'easeOut',
                          }}
                        />
                      )}
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={podcastBuffering ? 'loading' : podcastPlaying ? 'pause' : 'play'}
                          initial={{ opacity: 0, scale: 0.84, y: 1 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.84, y: -1 }}
                          transition={{ duration: 0.16 }}
                        >
                          {podcastBuffering ? (
                            <Spinner className="h-5 w-5" />
                          ) : (
                            <HugeiconsIcon
                              icon={podcastPlaying ? PauseIcon : PlayIcon}
                              className="h-5 w-5"
                              strokeWidth={2}
                            />
                          )}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  </TooltipTrigger>
                  <TooltipPanel>{podcastPlayLabel} (P)</TooltipPanel>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={toolbarButtonClass}
                        onClick={handleAddToPlaylist}
                        aria-label={_(msg`Add to playlist`)}
                        data-testid="entry-header-podcast-queue"
                      />
                    }
                  >
                    <HugeiconsIcon icon={Playlist03Icon} className="h-5 w-5" strokeWidth={2} />
                  </TooltipTrigger>
                  <TooltipPanel>{_(msg`Add to playlist`)} (Q)</TooltipPanel>
                </Tooltip>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      toolbarButtonClass,
                      'relative',
                      hasSummary && 'border-border/60 bg-accent/70 text-foreground'
                    )}
                    onClick={onSummarize}
                    disabled={isSummarizing}
                    aria-label={_(msg`Summarize with AI`)}
                  />
                }
              >
                <HugeiconsIcon
                  icon={SparklesIcon}
                  className={cn('h-5 w-5', isSummarizing && 'animate-pulse')}
                  strokeWidth={2}
                />
                {hasSummary && (
                  <span
                    className="absolute -end-0.5 -top-0.5 size-2 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                )}
              </TooltipTrigger>
              <TooltipPanel>
                {isSummarizing ? _(msg`Summarizing...`) : _(msg`Summarize with AI`)}
              </TooltipPanel>
            </Tooltip>

            <Popover>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            toolbarButtonClass,
                            'relative',
                            translationControlActive &&
                              'border-border/60 bg-accent/70 text-foreground'
                          )}
                          aria-label={_(msg`Translation options`)}
                        >
                          <HugeiconsIcon icon={Globe02Icon} className="h-5 w-5" strokeWidth={2} />
                          {translationControlActive && (
                            <span
                              className="absolute -end-0.5 -top-0.5 size-2 rounded-full bg-primary"
                              aria-hidden="true"
                            />
                          )}
                        </Button>
                      }
                    />
                  }
                />
                <TooltipPanel>{_(msg`Translation`)}</TooltipPanel>
              </Tooltip>
              <PopoverContent
                className="w-72 space-y-3 rounded-2xl border-border/60 bg-popover/95 p-3.5 shadow-xl"
                side="bottom"
                align="end"
              >
                <PopoverHeader>
                  <PopoverTitle>{_(msg`Translation`)}</PopoverTitle>
                </PopoverHeader>

                {isExcludedFeed ? (
                  <div className="rounded-md border border-border/50 px-2.5 py-2">
                    <p className="text-xs text-muted-foreground">
                      {_(msg`Translation disabled for this feed`)}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between rounded-md border border-border/50 px-2.5 py-2">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium">{_(msg`Translate now`)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {_(msg`Applies to all articles when enabled`)}
                        </p>
                      </div>
                      <Switch
                        checked={translationEnabled}
                        onCheckedChange={(checked) => onTranslationEnabledChange(Boolean(checked))}
                        aria-label={_(msg`Translate now`)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">{_(msg`Target language`)}</p>
                      <Select
                        value={translationTargetLanguage ?? 'en'}
                        onValueChange={(value: string) => onTranslationTargetLanguageChange(value)}
                      >
                        <SelectTrigger className="h-8 w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {translationTargetLanguageOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">{_(msg`Display mode`)}</p>
                      <Select
                        value={translationDisplayMode}
                        onValueChange={(value: string) =>
                          onTranslationDisplayModeChange(
                            value as AppPreferences['reader_translation_display_mode']
                          )
                        }
                      >
                        <SelectTrigger className="h-8 w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bilingual">{_(msg`Bilingual`)}</SelectItem>
                          <SelectItem value="translated_only">{_(msg`Translated only`)}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {activeTranslationProvider && (
                      <div
                        className="flex items-center justify-between rounded-md border border-border/50 px-2.5 py-2"
                        data-testid="active-translation-provider-badge"
                      >
                        <p className="text-xs text-muted-foreground">{_(msg`Provider`)}</p>
                        <p className="text-xs font-medium">
                          {getTranslationProviderLabel(activeTranslationProvider)}
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className="border-t border-border/40" />

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">{_(msg`中文顯示`)}</p>
                  <Select
                    value={chineseConversionMode}
                    onValueChange={(value: string) =>
                      setChineseConversionMode(value as ChineseConversionMode)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {conversionOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>

            <ReaderSettings />

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      toolbarButtonClass,
                      focusMode && 'border-border/60 bg-accent/70 text-foreground'
                    )}
                    onClick={() => onFocusModeChange(!focusMode)}
                    aria-label={_(msg`Focus mode`)}
                    aria-pressed={focusMode}
                  />
                }
              >
                <HugeiconsIcon icon={CenterFocusIcon} className="h-5 w-5" strokeWidth={2} />
              </TooltipTrigger>
              <TooltipPanel>{_(msg`Focus mode`)}</TooltipPanel>
            </Tooltip>

            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={toolbarButtonClass}
                    aria-label={_(msg`Reading display`)}
                    disabled={isLoading}
                  >
                    <HugeiconsIcon icon={TextIcon} className="h-5 w-5" strokeWidth={2} />
                  </Button>
                }
              />
              <PopoverContent
                className="w-72 space-y-3 rounded-2xl border-border/60 bg-popover/95 p-3.5 shadow-xl"
                side="bottom"
                align="start"
              >
                <PopoverHeader>
                  <PopoverTitle>{_(msg`Reading display`)}</PopoverTitle>
                </PopoverHeader>

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">{_(msg`Code theme`)}</p>
                  <Select
                    value={codeTheme}
                    onValueChange={(value: string) => {
                      if ((readerCodeThemeOptions as readonly string[]).includes(value)) {
                        setCodeTheme(value as ReaderCodeTheme);
                      }
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {readerCodeThemeOptions.map((themeOption) => (
                        <SelectItem key={themeOption} value={themeOption}>
                          {formatCodeThemeLabel(themeOption)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">{_(msg`Reading theme`)}</p>
                  <Select
                    value={selectedReaderTheme}
                    onValueChange={(value: string) => setReaderTheme(value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {readerThemeOptions.map((themeOption) => (
                        <SelectItem key={themeOption} value={themeOption}>
                          {getReaderThemeLabel(themeOption)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-md border border-border/50 px-2.5 py-2">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium">{_(msg`Bionic Reading`)}</p>
                    <p className="text-[11px] text-muted-foreground">{_(msg`English only`)}</p>
                  </div>
                  <Switch
                    checked={bionicReading}
                    onCheckedChange={(checked) => setBionicReading(Boolean(checked))}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border border-border/50 px-2.5 py-2">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium">{_(msg`Status Bar`)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {_(msg`Show reading progress at bottom-left`)}
                    </p>
                  </div>
                  <Switch
                    checked={statusBarVisible}
                    onCheckedChange={(checked) => setStatusBarVisible(Boolean(checked))}
                    disabled={isLoading}
                  />
                </div>
              </PopoverContent>
            </Popover>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={toolbarButtonClass}
                    onClick={onToggleRead}
                    disabled={isTogglingRead}
                    aria-label={isRead ? _(msg`Mark as unread`) : _(msg`Mark as read`)}
                  />
                }
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={isRead ? 'read' : 'unread'}
                    initial={{ scale: 0.6, opacity: 0, rotate: -90 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.6, opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.2, ease: 'backOut' }}
                  >
                    <HugeiconsIcon
                      icon={isRead ? MailOpen01Icon : Mail01Icon}
                      className="h-5 w-5"
                    />
                  </motion.div>
                </AnimatePresence>
              </TooltipTrigger>
              <TooltipPanel>{isRead ? _(msg`Mark as unread`) : _(msg`Mark as read`)}</TooltipPanel>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(toolbarButtonClass, isStarred && 'text-yellow-500')}
                    onClick={onToggleStar}
                    aria-label={isStarred ? _(msg`Unstar`) : _(msg`Star`)}
                  />
                }
              >
                <HugeiconsIcon icon={StarIcon} className="h-5 w-5" strokeWidth={2} />
              </TooltipTrigger>
              <TooltipPanel>{isStarred ? _(msg`Unstar`) : _(msg`Star`)}</TooltipPanel>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={toolbarButtonClass}
                    onClick={onFetchOriginalContent}
                    disabled={isFetchingOriginalContent}
                    aria-label={
                      isFetchingOriginalContent
                        ? fetchingOriginalContentLabel
                        : isOriginalContentDownloaded
                          ? originalContentDownloadedLabel
                          : fetchOriginalContentLabel
                    }
                  />
                }
              >
                {isFetchingOriginalContent ? (
                  <Spinner className="h-5 w-5" />
                ) : isOriginalContentDownloaded ? (
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-5 w-5 text-primary" />
                ) : (
                  <HugeiconsIcon icon={Download01Icon} className="h-5 w-5" />
                )}
              </TooltipTrigger>
              <TooltipPanel>
                {isFetchingOriginalContent
                  ? fetchingOriginalContentLabel
                  : isOriginalContentDownloaded
                    ? originalContentDownloadedLabel
                    : fetchOriginalContentLabel}
              </TooltipPanel>
            </Tooltip>

            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={toolbarButtonClass}
                    aria-label={_(msg`Share`)}
                  />
                }
              >
                <HugeiconsIcon icon={Share01Icon} className="h-5 w-5" />
              </PopoverTrigger>
              <PopoverContent
                className="w-56 p-1.5 rounded-xl border-border/60 bg-popover/95 shadow-xl"
                side="bottom"
                align="end"
              >
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent cursor-pointer"
                >
                  <HugeiconsIcon
                    icon={copiedUrl ? CheckmarkCircle02Icon : Copy01Icon}
                    className={copiedUrl ? 'h-4 w-4 text-primary' : 'h-4 w-4 text-muted-foreground'}
                  />
                  <span className={copiedUrl ? 'text-primary' : ''}>
                    {copiedUrl ? _(msg`URL copied!`) : _(msg`Copy article URL`)}
                  </span>
                </button>
                {entry.share_code && (
                  <button
                    type="button"
                    onClick={handleCopyShareCode}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent cursor-pointer"
                  >
                    <HugeiconsIcon
                      icon={copiedShareCode ? CheckmarkCircle02Icon : Share01Icon}
                      className={
                        copiedShareCode ? 'h-4 w-4 text-primary' : 'h-4 w-4 text-muted-foreground'
                      }
                    />
                    <span className={copiedShareCode ? 'text-primary' : ''}>
                      {copiedShareCode ? _(msg`Share link copied!`) : _(msg`Copy share link`)}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenInBrowser}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent cursor-pointer"
                >
                  <HugeiconsIcon icon={Globe02Icon} className="h-4 w-4 text-muted-foreground" />
                  <span>{_(msg`Open in browser`)}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveToServices}
                  disabled={isSavingToServices}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent cursor-pointer disabled:opacity-50"
                >
                  <HugeiconsIcon
                    icon={SentIcon}
                    className={
                      savedToServices ? 'h-4 w-4 text-primary' : 'h-4 w-4 text-muted-foreground'
                    }
                  />
                  <span className={savedToServices ? 'text-primary' : ''}>
                    {savedToServices ? _(msg`Saved!`) : _(msg`Save to services`)}
                  </span>
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <motion.div
          className="overflow-hidden px-3"
          style={{ opacity: smallTitleOpacity, height: smallTitleHeight }}
        >
          <h2 className="text-sm font-semibold truncate">{convertedTitle}</h2>
        </motion.div>
      </div>

      <motion.div
        style={{
          opacity: titleOpacity,
          scale: titleScale,
          y: titleY,
          maxHeight: titleMaxHeight,
          originX: 0,
          originY: 0,
          overflow: 'hidden',
        }}
        className="mt-1 flex w-full min-w-0 items-start justify-between gap-3 px-3"
      >
        <div className="flex w-full min-w-0 flex-1 basis-0 flex-col space-y-2.5 pb-2">
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block min-w-0 max-w-full hover:underline decoration-primary/50 underline-offset-4 [overflow-wrap:anywhere]"
            onClick={(e) => {
              if (onOpenInAppBrowser) {
                e.preventDefault();
                onOpenInAppBrowser(entry.url);
              }
            }}
          >
            <h1 className="max-w-full text-2xl font-bold leading-tight tracking-tight break-words [overflow-wrap:anywhere]">
              {convertedTitle}
            </h1>
          </a>
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <FeedAvatar title={entry.feed.title} domain={entry.feed.site_url} className="size-5!" />
            <a
              href={entry.feed.site_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground/80 transition-colors hover:text-foreground hover:underline decoration-primary/40 underline-offset-4"
            >
              {entry.feed.title}
            </a>
            {entry.author && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-muted-foreground/70">{entry.author}</span>
              </>
            )}
            <span className="text-muted-foreground/30">·</span>
            <time className="text-muted-foreground/70" dateTime={entry.published_at}>
              {formatShortDate(parseISO(entry.published_at), i18n.locale)}
            </time>
            {entry.reading_time && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="tabular-nums text-muted-foreground/70">
                  {entry.reading_time} {_(msg`min read`)}
                </span>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.header>
  );
}
