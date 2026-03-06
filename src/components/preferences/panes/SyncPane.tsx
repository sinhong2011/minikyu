import {
  Alert01Icon,
  CheckmarkCircle01Icon,
  InformationCircleIcon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showToast } from '@/components/ui/sonner';
import { Tooltip, TooltipPanel, TooltipTrigger } from '@/components/ui/tooltip';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { useSyncStore } from '@/store/sync-store';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';

const SYNC_INTERVAL_OPTIONS = [
  { value: '0', label: msg`Disabled` },
  { value: '5', label: msg`Every 5 minutes` },
  { value: '15', label: msg`Every 15 minutes` },
  { value: '30', label: msg`Every 30 minutes` },
  { value: '60', label: msg`Every hour` },
] as const;

export function SyncPane() {
  const { _ } = useLingui();

  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();

  const currentInterval = preferences?.sync_interval ?? 0;
  const syncing = useSyncStore((state) => state.syncing);
  const currentStage = useSyncStore((state) => state.currentStage);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);
  const error = useSyncStore((state) => state.error);
  const categoriesCount = useSyncStore((state) => state.categoriesCount);
  const feedsCount = useSyncStore((state) => state.feedsCount);
  const entriesProgress = useSyncStore((state) => state.entriesProgress);

  const formatFullDateTime = (date: Date) =>
    new Intl.DateTimeFormat(i18n.locale || undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);

  const handleSyncIntervalChange = async (value: string) => {
    if (!preferences) return;

    const minutes = Number(value);
    logger.info('Updating sync interval', { minutes });

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        sync_interval: minutes === 0 ? null : minutes,
      });
      showToast.success(minutes === 0 ? _(msg`Auto-sync disabled`) : _(msg`Sync interval updated`));
    } catch {
      logger.error('Failed to save sync interval');
      showToast.error(_(msg`Failed to update sync interval`));
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection title={_(msg`Status`)}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{_(msg`Current state`)}</span>
            <div className="flex items-center gap-1.5">
              {syncing ? (
                <Badge variant="secondary" className="text-xs gap-1">
                  <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" />
                  {currentStage === 'cleanup'
                    ? _(msg`Cleaning up`)
                    : currentStage === 'idle'
                      ? _(msg`Starting`)
                      : _(msg`Syncing ${currentStage}`)}
                </Badge>
              ) : error || currentStage === 'failed' ? (
                <Badge variant="destructive" className="text-xs gap-1">
                  <HugeiconsIcon icon={Alert01Icon} className="size-3" />
                  {_(msg`Failed`)}
                </Badge>
              ) : currentStage === 'completed' ? (
                <Badge variant="secondary" className="text-xs gap-1">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3" />
                  {_(msg`Up to date`)}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">{_(msg`Idle`)}</span>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {lastSyncedAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{_(msg`Last synced`)}</span>
              <span className="text-sm">{formatFullDateTime(lastSyncedAt)}</span>
            </div>
          )}

          {(categoriesCount !== undefined || feedsCount !== undefined || entriesProgress) && (
            <div
              className={cn(
                'space-y-1.5 rounded-md border px-3 py-2',
                error && 'border-destructive/30'
              )}
            >
              {categoriesCount !== undefined && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{_(msg`Categories`)}</span>
                  <span>{categoriesCount}</span>
                </div>
              )}
              {feedsCount !== undefined && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{_(msg`Feeds`)}</span>
                  <span>{feedsCount}</span>
                </div>
              )}
              {entriesProgress && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{_(msg`Entries`)}</span>
                  <span>
                    {syncing && entriesProgress.pulled < entriesProgress.total
                      ? `${entriesProgress.pulled} / ${entriesProgress.total}`
                      : entriesProgress.total}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title={_(msg`Sync`)}>
        <SettingsField
          label={
            <span className="inline-flex items-center gap-1.5">
              {_(msg`Auto-sync interval`)}
              <Tooltip>
                <TooltipTrigger>
                  <HugeiconsIcon
                    icon={InformationCircleIcon}
                    className="size-3.5 text-muted-foreground"
                  />
                </TooltipTrigger>
                <TooltipPanel>
                  {_(msg`Automatically sync feeds at the configured interval`)}
                </TooltipPanel>
              </Tooltip>
            </span>
          }
        >
          <Select value={String(currentInterval)} onValueChange={handleSyncIntervalChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYNC_INTERVAL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {_(option.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
