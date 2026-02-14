import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Globe02Icon,
  Mail01Icon,
  MailOpen01Icon,
  Share01Icon,
  StarIcon,
  TextIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { format, parseISO } from 'date-fns';
import { AnimatePresence, type MotionValue, motion } from 'motion/react';
import { useState } from 'react';
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
import { Tooltip, TooltipPanel, TooltipTrigger } from '@/components/ui/tooltip';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import type { Entry } from '@/lib/bindings';
import { normalizeReaderTheme, type ReaderTheme, readerThemeOptions } from '@/lib/reader-theme';
import { type ReaderCodeTheme, readerCodeThemeOptions } from '@/lib/shiki-highlight';
import type { ChineseConversionMode } from '@/lib/tauri-bindings';
import { ReaderSettings } from './ReaderSettings';

interface EntryReadingHeaderProps {
  entry: Entry;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  hideNavigation?: boolean;
  onToggleStar: () => void;
  onToggleRead: () => void;
  onShare?: () => void;
  onClose?: () => void;
  isRead: boolean;
  isTogglingRead: boolean;
  headerPadding: MotionValue<number>;
  smallTitleOpacity: MotionValue<number>;
  smallTitleHeight: MotionValue<number>;
  titleOpacity: MotionValue<number>;
  titleScale: MotionValue<number>;
  titleY: MotionValue<number>;
  titleMaxHeight: MotionValue<number>;
}

export function EntryReadingHeader({
  entry,
  onNavigatePrev,
  onNavigateNext,
  hasPrev,
  hasNext,
  hideNavigation = false,
  onToggleStar,
  onToggleRead,
  onShare,
  onClose,
  isRead,
  isTogglingRead,
  headerPadding,
  smallTitleOpacity,
  smallTitleHeight,
  titleOpacity,
  titleScale,
  titleY,
  titleMaxHeight,
}: EntryReadingHeaderProps) {
  const { _ } = useLingui();
  const {
    chineseConversionMode,
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

  const conversionOptions: Array<{
    value: ChineseConversionMode;
    label: string;
  }> = [
    { value: 'off', label: _(msg`Off`) },
    { value: 's2hk', label: _(msg`繁體中文（香港）`) },
    { value: 's2tw', label: _(msg`繁體中文（台灣）`) },
    { value: 't2s', label: _(msg`簡體中文`) },
  ];

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
  const toolbarButtonClass =
    'h-9 w-9 rounded-xl border border-transparent text-muted-foreground/90 hover:bg-accent/70 hover:text-foreground data-[state=open]:border-border/60 data-[state=open]:bg-accent/70 data-[state=open]:text-foreground';

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedShareCode, setCopiedShareCode] = useState(false);

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

  return (
    <motion.header
      className="sticky top-0 z-10 shrink-0 border-b border-border/50 bg-gradient-to-b from-background/75 via-background/58 to-background/45 shadow-[0_10px_28px_-24px_hsl(var(--foreground)/0.65)] supports-[backdrop-filter]:bg-background/35 backdrop-blur-2xl"
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
          </div>

          <div className="flex items-center gap-1.5">
            <ReaderSettings />

            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={toolbarButtonClass}
                    aria-label={_(msg`Chinese conversion`)}
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
                  <p className="text-xs text-muted-foreground">{_(msg`中文顯示`)}</p>
                  <Select
                    value={chineseConversionMode}
                    onValueChange={(value) =>
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

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">{_(msg`Code theme`)}</p>
                  <Select
                    value={codeTheme}
                    onValueChange={(value) => {
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
                    onValueChange={(value) => setReaderTheme(value)}
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
                    onClick={onToggleStar}
                    aria-label={entry.starred ? _(msg`Unstar`) : _(msg`Star`)}
                  />
                }
              >
                <HugeiconsIcon
                  icon={StarIcon}
                  className={entry.starred ? 'h-5 w-5 fill-primary text-primary' : 'h-5 w-5'}
                />
              </TooltipTrigger>
              <TooltipPanel>{entry.starred ? _(msg`Unstar`) : _(msg`Star`)}</TooltipPanel>
            </Tooltip>

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
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <motion.div
          className="overflow-hidden px-3"
          style={{ opacity: smallTitleOpacity, height: smallTitleHeight }}
        >
          <h2 className="text-sm font-semibold truncate">{entry.title}</h2>
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
        className="mt-1 flex items-start justify-between px-3"
      >
        <div className="flex flex-col flex-1 space-y-2 pb-2">
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline decoration-primary/50 underline-offset-4"
          >
            <h1 className="text-2xl font-bold">{entry.title}</h1>
          </a>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FeedAvatar title={entry.feed.title} domain={entry.feed.site_url} className="size-4!" />
            <a
              href={entry.feed.site_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground/85 transition-colors hover:text-foreground hover:underline decoration-primary/40 underline-offset-4"
            >
              {entry.feed.title}
            </a>
            {entry.author && (
              <>
                <span>•</span>
                <span>{entry.author}</span>
              </>
            )}
            <span>•</span>
            <span>{format(parseISO(entry.published_at), 'PPp')}</span>
            {entry.reading_time && (
              <>
                <span>•</span>
                <span>{entry.reading_time} min read</span>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.header>
  );
}
