import {
  CheckmarkCircle01Icon,
  Copy01Icon,
  Globe02Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipPanel, TooltipTrigger } from '@/components/ui/tooltip';
import { useClipboard } from '@/hooks/use-clipboard';
import {
  type TranslationRoutingPreferences,
  translateReaderSegmentWithPreferences,
} from '@/services/translation';

const TOOLBAR_WIDTH = 140;
const GAP = 8;

interface ToolbarPosition {
  top: number;
  left: number;
}

function computePosition(rect: DOMRect): ToolbarPosition {
  let left = rect.left + rect.width / 2 - TOOLBAR_WIDTH / 2;
  let top = rect.top - 44 - GAP;
  left = Math.max(8, Math.min(left, window.innerWidth - TOOLBAR_WIDTH - 8));
  if (top < 8) top = rect.bottom + GAP;
  return { top, left };
}

interface ReaderSelectionToolbarProps {
  containerRef: React.RefObject<HTMLElement | null>;
  translationPreferences: TranslationRoutingPreferences;
  sourceLanguage?: string | null;
}

type TranslationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; text: string; provider: string }
  | { status: 'error' };

export function ReaderSelectionToolbar({
  containerRef,
  translationPreferences,
  sourceLanguage,
}: ReaderSelectionToolbarProps) {
  const { _ } = useLingui();
  const { copy, copied } = useClipboard(1500);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<ToolbarPosition>({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [translationState, setTranslationState] = useState<TranslationState>({ status: 'idle' });
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      const container = containerRef.current;

      // Only show toolbar for selections inside the reader container
      if (container && !container.contains(e.target as Node)) {
        return;
      }

      // Skip if click target is a node menu trigger
      if ((e.target as Element).closest?.('.reader-node-menu-trigger')) {
        return;
      }

      requestAnimationFrame(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim() ?? '';

        if (!text || !selection || selection.rangeCount === 0) {
          return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const pos = computePosition(rect);

        setSelectedText(text);
        setPosition(pos);
        setTranslationState({ status: 'idle' });
        setVisible(true);
      });
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [containerRef]);

  useEffect(() => {
    if (!visible) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVisible(false);
      }
    };

    const container = containerRef.current;
    const handleScroll = () => setVisible(false);

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [visible, containerRef]);

  const handleTranslate = async () => {
    if (!selectedText) return;
    setTranslationState({ status: 'loading' });
    try {
      const result = await translateReaderSegmentWithPreferences({
        text: selectedText,
        sourceLanguage,
        preferences: translationPreferences,
      });
      setTranslationState({
        status: 'done',
        text: result.translatedText,
        provider: result.providerUsed,
      });
    } catch {
      setTranslationState({ status: 'error' });
    }
  };

  const handleCopy = () => {
    copy(selectedText);
  };

  const handleSearch = () => {
    openUrl(`https://www.google.com/search?q=${encodeURIComponent(selectedText)}`).catch(() => {});
  };

  const translateLabel = _(msg`Translate selection`);
  const copyLabel = copied ? _(msg`Copied`) : _(msg`Copy`);
  const searchLabel = _(msg`Search`);

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 50 }}
          className="flex flex-col items-start gap-1"
        >
          <div className="flex items-center gap-0.5 rounded-xl border border-border/60 bg-popover/90 supports-[backdrop-filter]:bg-popover/75 p-1 shadow-lg backdrop-blur-xl">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.12] hover:text-foreground"
                    aria-label={translateLabel}
                    onClick={handleTranslate}
                  />
                }
              >
                <HugeiconsIcon icon={Globe02Icon} className="h-4 w-4" strokeWidth={2} />
              </TooltipTrigger>
              <TooltipPanel>{translateLabel}</TooltipPanel>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.12] hover:text-foreground"
                    aria-label={copyLabel}
                    onClick={handleCopy}
                  />
                }
              >
                <HugeiconsIcon
                  icon={copied ? CheckmarkCircle01Icon : Copy01Icon}
                  className="h-4 w-4"
                  strokeWidth={2}
                />
              </TooltipTrigger>
              <TooltipPanel>{copyLabel}</TooltipPanel>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.12] hover:text-foreground"
                    aria-label={searchLabel}
                    onClick={handleSearch}
                  />
                }
              >
                <HugeiconsIcon icon={Search01Icon} className="h-4 w-4" strokeWidth={2} />
              </TooltipTrigger>
              <TooltipPanel>{searchLabel}</TooltipPanel>
            </Tooltip>
          </div>

          <AnimatePresence>
            {translationState.status !== 'idle' && (
              <motion.div
                key="translation-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="max-w-80 rounded-xl border border-border/60 bg-popover/90 supports-[backdrop-filter]:bg-popover/75 p-3 shadow-lg backdrop-blur-xl">
                  {translationState.status === 'loading' && (
                    <div className="flex items-center justify-center py-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
                      />
                    </div>
                  )}
                  {translationState.status === 'done' && (
                    <div className="space-y-2">
                      <p className="text-sm leading-relaxed text-foreground">
                        {translationState.text}
                      </p>
                      <span className="inline-flex items-center rounded-md border border-border/50 bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {_(msg`via ${translationState.provider}`)}
                      </span>
                    </div>
                  )}
                  {translationState.status === 'error' && (
                    <p className="text-sm text-destructive">{_(msg`Translation failed`)}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
