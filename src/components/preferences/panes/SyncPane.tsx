import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showToast } from '@/components/ui/sonner';
import { logger } from '@/lib/logger';
import { usePreferences, useSavePreferences } from '@/services/preferences';
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
      <SettingsSection title={_(msg`Sync`)}>
        <SettingsField
          label={_(msg`Auto-sync interval`)}
          description={_(msg`Automatically sync feeds at the configured interval`)}
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
