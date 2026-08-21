import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useRef } from 'react';
import { EntryEmptyState } from '@/components/miniflux/EntryEmptyState';
import { EntryReading } from '@/components/miniflux/EntryReading';
import { InAppBrowserPane } from '@/components/miniflux/InAppBrowserPane';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { useInAppBrowser } from '@/hooks/use-in-app-browser';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSelectedEntryId } from '@/hooks/use-selected-entry';
import { cn } from '@/lib/utils';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { useUIStore } from '@/store/ui-store';

interface MainWindowContentProps {
  children?: React.ReactNode;
  className?: string;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  onClose?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  nextEntryTitle?: string;
  entryTransitionDirection?: 'forward' | 'backward';
}

export function MainWindowContent({
  children,
  className,
  onNavigatePrev,
  onNavigateNext,
  onClose,
  hasPrev = false,
  hasNext = false,
  nextEntryTitle,
  entryTransitionDirection = 'forward',
}: MainWindowContentProps) {
  const lastQuickPaneEntry = useUIStore((state) => state.lastQuickPaneEntry);
  const selectedEntryId = useSelectedEntryId();
  const { openBrowser, closeBrowser, browserContentRef, inAppBrowserUrl } = useInAppBrowser();
  const isMobile = useIsMobile();
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedWidth = preferences?.layout_entry_list_width ?? undefined;
  const prefersReducedMotion = useReducedMotion();

  // The phone reader is an overlay that animates out, so it has to outlive the
  // selection that opened it. Remember the last subject and keep rendering it
  // for the duration of the exit, otherwise the pane would flip to the empty
  // state and slide *that* off screen.
  const mobileOverlayOpen = Boolean(inAppBrowserUrl || selectedEntryId);
  const lastMobileEntryIdRef = useRef<string | null | undefined>(null);
  const lastMobileBrowserUrlRef = useRef<string | null | undefined>(null);
  if (mobileOverlayOpen) {
    lastMobileEntryIdRef.current = selectedEntryId;
    lastMobileBrowserUrlRef.current = inAppBrowserUrl;
  }
  const mobileEntryId = mobileOverlayOpen ? selectedEntryId : lastMobileEntryIdRef.current;
  const mobileBrowserUrl = mobileOverlayOpen ? inAppBrowserUrl : lastMobileBrowserUrlRef.current;

  const handlePanelResize = useCallback(
    (panelSize: { inPixels: number; asPercentage: number }) => {
      if (!preferences) return;
      const width = Math.round(panelSize.inPixels);
      if (width === (preferences.layout_entry_list_width ?? 435)) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        savePreferences.mutate({
          ...preferences,
          layout_entry_list_width: width,
        });
      }, 500);
    },
    [preferences, savePreferences]
  );

  /**
   * The reader (or in-app browser). Shared by both layouts: side-by-side on
   * wide screens, and full-width on phones where a 380px list plus a reader
   * cannot both fit — there the reader replaces the list until it is closed.
   *
   * Takes its subject as arguments rather than reading the store directly, so
   * the phone overlay can keep rendering the outgoing entry while it animates
   * away — see `mobileEntryId` below.
   */
  const renderReadingPane = (
    entryId: string | null | undefined,
    browserUrl: string | null | undefined
  ) => (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden">
      <AnimatePresence mode="sync">
        {browserUrl ? (
          <motion.div
            key="browser"
            className="absolute inset-0 flex flex-col p-2"
            initial={{ opacity: 0, filter: 'blur(0.8px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{
              opacity: 0,
              filter: 'blur(0.8px)',
              transition: {
                filter: { duration: 0.28, ease: [0.35, 0, 0.9, 1] },
                opacity: { duration: 0.24, ease: [0.45, 0, 1, 1] },
              },
            }}
            transition={{
              filter: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.32, ease: [0.2, 0.95, 0.35, 1] },
            }}
          >
            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/30">
              <InAppBrowserPane
                url={browserUrl}
                onClose={closeBrowser}
                browserContentRef={browserContentRef}
              />
            </div>
          </motion.div>
        ) : entryId ? (
          <motion.div
            key="reading"
            className="flex h-full min-w-0 flex-col"
            initial={{ opacity: 0, x: 18, filter: 'blur(0.8px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{
              opacity: 0,
              x: -8,
              filter: 'blur(0.8px)',
              transition: {
                x: { duration: 0.3, ease: [0.35, 0, 0.9, 1] },
                filter: { duration: 0.28, ease: [0.35, 0, 0.9, 1] },
                opacity: { duration: 0.24, ease: [0.45, 0, 1, 1] },
              },
            }}
            transition={{
              x: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
              filter: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.32, ease: [0.2, 0.95, 0.35, 1] },
            }}
          >
            <EntryReading
              entryId={entryId}
              onNavigatePrev={onNavigatePrev}
              onNavigateNext={onNavigateNext}
              onClose={onClose}
              hasPrev={hasPrev}
              hasNext={hasNext}
              nextEntryTitle={nextEntryTitle}
              transitionDirection={entryTransitionDirection}
              onOpenInAppBrowser={openBrowser}
            />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            className="flex flex-1 flex-col items-center justify-center bg-muted/10"
            initial={{ opacity: 0, filter: 'blur(0.8px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{
              opacity: 0,
              filter: 'blur(0.8px)',
              transition: {
                opacity: { duration: 0.24, ease: [0.45, 0, 1, 1] },
                filter: { duration: 0.22, ease: [0.35, 0, 0.9, 1] },
              },
            }}
            transition={{
              opacity: { duration: 0.32, ease: [0.2, 0.95, 0.35, 1] },
              filter: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
            }}
          >
            <EntryEmptyState />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div data-frosted className={cn('flex h-full min-w-0 flex-col bg-background', className)}>
      {children ? (
        isMobile ? (
          // Single pane on phones: the reader overlays the list instead of
          // replacing it, so the list keeps its mount state — closing the
          // reader returns instantly, without replaying entry animations or
          // losing the scroll position. `onClose` clears the selection, so the
          // reader's close button is "back".
          <div className="relative h-full overflow-hidden">
            <div className="h-full overflow-hidden">{children}</div>
            {/*
              Sibling of the reader overlay, and below it: the bar stays put
              while the reader slides over it, and is revealed again as the
              reader slides away.
            */}
            <MobileTabBar />
            <AnimatePresence initial={false}>
              {mobileOverlayOpen && (
                <motion.div
                  key="mobile-reader"
                  className="absolute inset-0 z-40 bg-background shadow-[-12px_0_32px_-16px_rgb(0_0_0/0.55)]"
                  initial={prefersReducedMotion ? { opacity: 0 } : { x: '100%' }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { x: '0%' }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { x: '100%' }}
                  transition={{
                    duration: prefersReducedMotion ? 0.15 : 0.34,
                    ease: [0.32, 0.72, 0, 1],
                  }}
                >
                  {renderReadingPane(mobileEntryId, mobileBrowserUrl)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <ResizablePanelGroup orientation="horizontal" className="h-full">
            <ResizablePanel
              id="entry-list"
              defaultSize={savedWidth ?? 435}
              minSize={380}
              maxSize={480}
              onResize={handlePanelResize}
            >
              <div className="h-full overflow-hidden">{children}</div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="entry-reading">
              {renderReadingPane(selectedEntryId, inAppBrowserUrl)}
            </ResizablePanel>
          </ResizablePanelGroup>
        )
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center">
          <h1 className="text-4xl font-bold text-foreground">
            {lastQuickPaneEntry ? `Last entry: ${lastQuickPaneEntry}` : 'Hello World'}
          </h1>
        </div>
      )}
    </div>
  );
}
