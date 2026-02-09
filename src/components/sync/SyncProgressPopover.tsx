import {
  CheckmarkCircle01Icon,
  CircleIcon,
  Delete02Icon,
  File01Icon,
  Folder01Icon,
  Loading03Icon,
  RssIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useSyncStore } from '@/store/sync-store';

interface SyncProgressPopoverProps {
  children: React.ReactElement;
}

export function SyncProgressPopover({ children }: SyncProgressPopoverProps) {
  const { _ } = useLingui();
  const [open, setOpen] = useState(false);
  const syncing = useSyncStore((state) => state.syncing);
  const currentStage = useSyncStore((state) => state.currentStage);
  const categoriesCount = useSyncStore((state) => state.categoriesCount);
  const feedsCount = useSyncStore((state) => state.feedsCount);
  const entriesProgress = useSyncStore((state) => state.entriesProgress);
  const error = useSyncStore((state) => state.error);

  useEffect(() => {
    if (syncing) {
      setOpen(true);
    } else if (currentStage === 'completed' || currentStage === 'failed') {
      const timer = setTimeout(() => {
        setOpen(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [syncing, currentStage]);

  const stages = [
    {
      id: 'categories',
      label: _(msg`Categories`),
      icon: Folder01Icon,
      count: categoriesCount,
    },
    {
      id: 'feeds',
      label: _(msg`Feeds`),
      icon: RssIcon,
      count: feedsCount,
    },
    {
      id: 'entries',
      label: _(msg`Entries`),
      icon: File01Icon,
      progress: entriesProgress,
    },
    {
      id: 'cleanup',
      label: _(msg`Cleanup`),
      icon: Delete02Icon,
    },
  ];

  const getStageStatus = (stageId: string) => {
    if (error) return 'error';
    if (currentStage === 'completed') return 'completed';
    if (currentStage === 'failed') return 'error';

    const stageOrder = ['categories', 'feeds', 'entries', 'cleanup'];
    const currentIndex = stageOrder.indexOf(currentStage);
    const stageIndex = stageOrder.indexOf(stageId);

    if (currentStage === stageId) return 'active';
    if (stageIndex < currentIndex) return 'completed';
    return 'pending';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={children} openOnHover delay={200} />
      <PopoverContent className="w-80 p-4" align="end" side="bottom">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="font-medium leading-none">{_(msg`Sync Progress`)}</h4>
            {syncing && (
              <HugeiconsIcon
                icon={Loading03Icon}
                className="h-4 w-4 animate-spin text-muted-foreground"
              />
            )}
          </div>

          <div className="space-y-3">
            {stages.map((stage) => {
              const status = getStageStatus(stage.id);
              const isActive = status === 'active';
              const isCompleted = status === 'completed';
              const isPending = status === 'pending';

              return (
                <div key={stage.id} className="space-y-1">
                  <div className="flex items-center gap-3 text-sm">
                    <div
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full border',
                        isActive && 'border-primary text-primary',
                        isCompleted && 'border-primary bg-primary text-primary-foreground',
                        isPending && 'border-muted-foreground/30 text-muted-foreground/30'
                      )}
                    >
                      {isActive ? (
                        <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin" />
                      ) : isCompleted ? (
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3 w-3" />
                      ) : (
                        <HugeiconsIcon icon={CircleIcon} className="h-3 w-3" />
                      )}
                    </div>
                    <div className="flex flex-1 items-center justify-between">
                      <span
                        className={cn(
                          isActive && 'font-medium text-foreground',
                          isCompleted && 'text-muted-foreground',
                          isPending && 'text-muted-foreground/50'
                        )}
                      >
                        {stage.label}
                      </span>
                      {stage.count !== undefined && (isCompleted || isActive) && (
                        <span className="text-xs text-muted-foreground">{stage.count}</span>
                      )}
                    </div>
                  </div>

                  {stage.id === 'entries' && (isActive || isCompleted) && stage.progress && (
                    <div className="ml-9 space-y-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-primary transition-all duration-300 ease-in-out"
                          style={{ width: `${stage.progress.percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {stage.progress.pulled} / {stage.progress.total}
                        </span>
                        <span>{Math.round(stage.progress.percentage)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{error}</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
