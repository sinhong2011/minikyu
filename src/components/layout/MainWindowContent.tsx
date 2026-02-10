import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { EntryReading } from '@/components/miniflux/EntryReading';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';

interface MainWindowContentProps {
  children?: React.ReactNode;
  className?: string;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  entryTransitionDirection?: 'forward' | 'backward';
}

export function MainWindowContent({
  children,
  className,
  onNavigatePrev,
  onNavigateNext,
  hasPrev = false,
  hasNext = false,
  entryTransitionDirection = 'forward',
}: MainWindowContentProps) {
  const { _ } = useLingui();
  const lastQuickPaneEntry = useUIStore((state) => state.lastQuickPaneEntry);
  const selectedEntryId = useUIStore((state) => state.selectedEntryId);

  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      {children ? (
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel defaultSize={'30%'} minSize={'25%'} maxSize={'35%'}>
            <div className="h-full overflow-hidden">{children}</div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel>
            <div className="flex h-full flex-col border-l">
              {selectedEntryId ? (
                <EntryReading
                  entryId={selectedEntryId}
                  onNavigatePrev={onNavigatePrev}
                  onNavigateNext={onNavigateNext}
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                  transitionDirection={entryTransitionDirection}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center bg-muted/10">
                  <div className="text-center p-8">
                    <p className="text-muted-foreground">{_(msg`Select an entry to read`)}</p>
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
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
