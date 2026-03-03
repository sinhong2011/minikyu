import {
  Alert01Icon,
  CheckmarkCircle01Icon,
  CircleIcon,
  Loading03Icon,
  UserIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useActiveAccount } from '@/services/miniflux/accounts';
import { usePreferences } from '@/services/preferences';
import { useSyncStore } from '@/store/sync-store';

interface SyncProgressPopoverProps {
  children: React.ReactElement;
}

type StageId = 'categories' | 'feeds' | 'entries' | 'cleanup';
type StageStatus = 'active' | 'completed' | 'pending' | 'error';
type EntryProgress = { pulled: number; total: number; percentage: number };

interface SyncStageDefinition {
  id: StageId;
  label: string;
  description: string;
  count?: number;
  progress?: EntryProgress;
}

const stageOrder: StageId[] = ['categories', 'feeds', 'entries', 'cleanup'];

export function SyncProgressPopover({ children }: SyncProgressPopoverProps) {
  const { _ } = useLingui();
  const { data: preferences } = usePreferences();
  const { data: currentAccount } = useActiveAccount();
  const syncing = useSyncStore((state) => state.syncing);
  const currentStage = useSyncStore((state) => state.currentStage);
  const categoriesCount = useSyncStore((state) => state.categoriesCount);
  const feedsCount = useSyncStore((state) => state.feedsCount);
  const entriesProgress = useSyncStore((state) => state.entriesProgress);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);
  const error = useSyncStore((state) => state.error);

  const stages: SyncStageDefinition[] = [
    {
      id: 'categories',
      label: _(msg`Categories`),
      description: _(msg`Sync your category folders`),
      count: categoriesCount,
    },
    {
      id: 'feeds',
      label: _(msg`Feeds`),
      description: _(msg`Sync feed sources in each category`),
      count: feedsCount,
    },
    {
      id: 'entries',
      label: _(msg`Entries`),
      description: _(msg`Sync article content and metadata`),
      progress: entriesProgress,
    },
    {
      id: 'cleanup',
      label: _(msg`Cleanup`),
      description: _(msg`Clean up local items removed from server`),
    },
  ];

  const getStageStatus = (stageId: StageId): StageStatus => {
    if (error || currentStage === 'failed') {
      if (stageId === 'categories' && categoriesCount !== undefined) return 'completed';
      if (stageId === 'feeds' && feedsCount !== undefined) return 'completed';
      if (stageId === 'entries' && entriesProgress && entriesProgress.pulled > 0) return 'error';
      return 'pending';
    }

    if (currentStage === 'completed') return 'completed';
    if (currentStage === 'idle') return 'pending';

    const currentIndex = stageOrder.indexOf(currentStage);
    const stageIndex = stageOrder.indexOf(stageId);

    if (currentStage === stageId) return 'active';
    if (stageIndex < currentIndex) return 'completed';
    return 'pending';
  };

  const getStageMetric = (stage: SyncStageDefinition, status: StageStatus) => {
    if (
      stage.id === 'entries' &&
      stage.progress &&
      (status === 'active' || status === 'completed')
    ) {
      return _(msg`${stage.progress.pulled} / ${stage.progress.total} entries`);
    }

    if (
      stage.id === 'categories' &&
      stage.count !== undefined &&
      (status === 'active' || status === 'completed')
    ) {
      return _(msg`${stage.count} categories`);
    }

    if (
      stage.id === 'feeds' &&
      stage.count !== undefined &&
      (status === 'active' || status === 'completed')
    ) {
      return _(msg`${stage.count} feeds`);
    }

    if (status === 'error') return _(msg`Failed`);
    if (status === 'active') return _(msg`Running`);
    if (status === 'completed') return _(msg`Done`);
    return _(msg`Queued`);
  };

  const getStageDetail = (stage: SyncStageDefinition, status: StageStatus) => {
    if (status === 'active') {
      if (stage.id === 'categories') return _(msg`Pulling category groups from server`);
      if (stage.id === 'feeds') return _(msg`Pulling feed subscriptions from server`);
      if (stage.id === 'entries' && stage.progress) {
        return _(msg`${stage.progress.pulled} of ${stage.progress.total} entries downloaded`);
      }
      if (stage.id === 'entries') return _(msg`Downloading recent entries from server`);
      return _(msg`Removing stale local records`);
    }

    if (status === 'completed') {
      if (stage.id === 'categories' && stage.count !== undefined) {
        return _(msg`${stage.count} categories synced`);
      }
      if (stage.id === 'feeds' && stage.count !== undefined) {
        return _(msg`${stage.count} feeds synced`);
      }
      if (stage.id === 'entries' && stage.progress) {
        return _(msg`${stage.progress.total} entries synced`);
      }
      return _(msg`Cleanup complete`);
    }

    if (status === 'error') return _(msg`This step did not finish`);
    return stage.description;
  };

  const activeStage = stages.find((stage) => getStageStatus(stage.id) === 'active');
  const totalSteps = stages.length;

  const use24h = preferences?.time_format !== '12h';
  const formatSyncTime = (date: Date) =>
    new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: !use24h,
    }).format(date);

  const statusTitle =
    error || currentStage === 'failed'
      ? _(msg`Sync failed`)
      : syncing
        ? _(msg`Syncing your Miniflux data`)
        : currentStage === 'completed'
          ? _(msg`Everything is up to date`)
          : _(msg`Sync is idle`);

  const statusDescription =
    error ||
    (syncing && activeStage
      ? _(
          msg`Step ${stageOrder.indexOf(activeStage.id) + 1} of ${totalSteps}: ${activeStage.label}`
        )
      : syncing
        ? _(msg`Preparing sync stages`)
        : currentStage === 'completed' && lastSyncedAt
          ? _(msg`Last synced at ${formatSyncTime(lastSyncedAt)}`)
          : currentStage === 'completed'
            ? _(msg`All categories, feeds, and entries are synced`)
            : _(msg`Run sync to refresh categories, feeds, and entries`));

  return (
    <Popover>
      <PopoverTrigger render={<div className="inline-flex">{children}</div>} />
      <PopoverContent className="w-[22rem] p-4" align="end" side="bottom">
        <div className="space-y-4">
          <div className="space-y-2 border-b pb-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium leading-none">{_(msg`Sync Status`)}</h4>
              {syncing && (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="h-4 w-4 animate-spin text-muted-foreground"
                />
              )}
            </div>
            {currentAccount && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <HugeiconsIcon icon={UserIcon} className="h-3 w-3" />
                <span>{currentAccount.username}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{statusTitle}</p>
            <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground/80')}>
              {statusDescription}
            </p>
          </div>

          <div className="relative">
            {stages.map((stage, index) => {
              const status = getStageStatus(stage.id);
              const isActive = status === 'active';
              const isCompleted = status === 'completed';
              const isPending = status === 'pending';
              const isError = status === 'error';
              const isLast = index === stages.length - 1;

              return (
                <div key={stage.id} className="relative flex gap-3">
                  {/* Vertical line + circle column */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                        isActive && 'border-primary bg-primary/10 text-primary',
                        isCompleted && 'border-primary bg-primary text-primary-foreground',
                        isPending && 'border-muted-foreground/30 text-muted-foreground/30',
                        isError && 'border-destructive/60 bg-destructive/10 text-destructive'
                      )}
                    >
                      {isActive ? (
                        <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin" />
                      ) : isCompleted ? (
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3 w-3" />
                      ) : isError ? (
                        <HugeiconsIcon icon={Alert01Icon} className="h-3 w-3" />
                      ) : (
                        <HugeiconsIcon icon={CircleIcon} className="h-3 w-3" />
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className={cn(
                          'w-px flex-1 min-h-4 transition-colors',
                          isCompleted ? 'bg-primary/50' : 'bg-border'
                        )}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className={cn('min-w-0 flex-1', !isLast ? 'pb-4' : 'pb-0')}>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'text-sm',
                          isActive && 'font-medium text-foreground',
                          isCompleted && 'text-foreground/80',
                          isPending && 'text-muted-foreground/70',
                          isError && 'font-medium text-destructive'
                        )}
                      >
                        {stage.label}
                      </span>
                      <span
                        className={cn(
                          'text-xs shrink-0',
                          isError ? 'text-destructive' : 'text-muted-foreground'
                        )}
                      >
                        {getStageMetric(stage, status)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'text-xs mt-0.5',
                        isError ? 'text-destructive/90' : 'text-muted-foreground/75'
                      )}
                    >
                      {getStageDetail(stage, status)}
                    </p>

                    {stage.id === 'entries' && (isActive || isCompleted) && stage.progress && (
                      <div className="mt-2 space-y-1">
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
                </div>
              );
            })}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{error}</div>
          )}

          <div className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs text-muted-foreground">
            {_(
              msg`Tip: "Categories" means folders, "Feeds" means subscriptions, and "Entries" means articles.`
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
