import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Switch } from '@/components/animate-ui/components/base/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showToast } from '@/components/ui/sonner';
import { logger } from '@/lib/logger';
import { commands } from '@/lib/tauri-bindings';
import { useAccountStore } from '@/store/account-store';
import { useReaderStore } from '@/store/reader-store';
import { useSyncStore } from '@/store/sync-store';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';

export function AdvancedPane() {
  const { _ } = useLingui();
  const queryClient = useQueryClient();
  const [exampleAdvancedToggle, setExampleAdvancedToggle] = useState(false);
  const [exampleDropdown, setExampleDropdown] = useState('option1');
  const [clearingData, setClearingData] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const handleClearLocalData = async () => {
    if (clearingData) return;

    setClearingData(true);
    try {
      const result = await commands.clearLocalData();
      if (result.status === 'error') {
        throw new Error(result.error);
      }

      await commands.minifluxDisconnect();

      queryClient.clear();
      useAccountStore.getState().clearAccounts();
      useReaderStore.getState().resetReaderState();
      useSyncStore.getState().setSyncing(false);
      useSyncStore.getState().setError(null);
      useSyncStore.getState().setLastSyncedAt(null);
      useSyncStore.getState().setCurrentStage('idle');

      setClearDialogOpen(false);
      showToast.success(
        _(msg`Local data cleared`),
        _(msg`Please restart the app to complete cleanup.`)
      );
    } catch (error) {
      logger.error('Failed to clear local data', { error });
      showToast.error(
        _(msg`Failed to clear local data`),
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setClearingData(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection title={_(msg`Example Advanced Settings`)}>
        <SettingsField
          label={_(msg`Example Advanced Toggle`)}
          description={_(msg`This is an example advanced toggle setting (not persisted)`)}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="example-advanced-toggle"
              checked={exampleAdvancedToggle}
              onCheckedChange={setExampleAdvancedToggle}
            />
            <Label htmlFor="example-advanced-toggle" className="text-sm">
              {exampleAdvancedToggle ? _(msg`Enabled`) : _(msg`Disabled`)}
            </Label>
          </div>
        </SettingsField>

        <SettingsField
          label={_(msg`Example Dropdown Setting`)}
          description={_(msg`This is an example dropdown/select setting (not persisted)`)}
        >
          <Select value={exampleDropdown} onValueChange={setExampleDropdown}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">{_(msg`Example Option 1`)}</SelectItem>
              <SelectItem value="option2">{_(msg`Example Option 2`)}</SelectItem>
              <SelectItem value="option3">{_(msg`Example Option 3`)}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={_(msg`Data`)}>
        <SettingsField
          label={_(msg`Clear local data`)}
          description={_(
            msg`Removes the local database, preferences, reading state, and recovery files. Downloaded files are not deleted.`
          )}
        >
          <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
            <AlertDialogTrigger
              render={
                <Button variant="destructive" disabled={clearingData}>
                  {clearingData ? _(msg`Clearing...`) : _(msg`Clear local data`)}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{_(msg`Clear local data?`)}</AlertDialogTitle>
                <AlertDialogDescription>
                  {_(msg`This will remove all locally stored data and disconnect your account.`)}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{_(msg`Cancel`)}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearLocalData}
                  variant="destructive"
                  disabled={clearingData}
                >
                  {_(msg`Clear data`)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
