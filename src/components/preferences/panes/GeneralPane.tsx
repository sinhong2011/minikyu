import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/animate-ui/components/radix/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { logger } from '@/lib/logger';
import { type CloseBehavior, commands } from '@/lib/tauri-bindings';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { ShortcutPicker } from '../ShortcutPicker';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';

export function GeneralPane() {
  const { _ } = useLingui();
  const [exampleText, setExampleText] = useState('Example value');
  const [exampleToggle, setExampleToggle] = useState(true);

  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();

  const { data: defaultShortcut } = useQuery({
    queryKey: ['default-quick-pane-shortcut'],
    queryFn: async () => {
      return await commands.getDefaultQuickPaneShortcut();
    },
    staleTime: Infinity,
  });

  const handleShortcutChange = async (newShortcut: string | null) => {
    if (!preferences) return;

    const oldShortcut = preferences.quick_pane_shortcut;

    logger.info('Updating quick pane shortcut', { oldShortcut, newShortcut });

    const result = await commands.updateQuickPaneShortcut(newShortcut);

    if (result.status === 'error') {
      logger.error('Failed to register shortcut', { error: result.error });
      toast.error(_(msg`Failed to register shortcut`), {
        description: result.error,
      });
      return;
    }

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        quick_pane_shortcut: newShortcut,
      });
    } catch {
      logger.warn('Save failed, rolling back shortcut registration', {
        oldShortcut,
        newShortcut,
      });

      const rollbackResult = await commands.updateQuickPaneShortcut(oldShortcut);

      if (rollbackResult.status === 'error') {
        logger.error('Rollback failed - backend and preferences are out of sync', {
          error: rollbackResult.error,
          attemptedShortcut: newShortcut,
          originalShortcut: oldShortcut,
        });
        toast.error(_(msg`Failed to restore previous shortcut`), {
          description: _(
            msg`The shortcut may be out of sync. Please restart the app or try again.`
          ),
        });
      } else {
        logger.info('Successfully rolled back shortcut registration');
      }
    }
  };

  const handleCloseBehaviorChange = async (value: CloseBehavior) => {
    if (!preferences) return;

    logger.info('Updating close behavior', { behavior: value });

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        close_behavior: value,
      });
      toast.success(_(msg`Close behavior updated`));
    } catch {
      logger.error('Failed to save close behavior');
      toast.error(_(msg`Failed to update close behavior`));
    }
  };

  const handleShowTrayIconChange = async (checked: boolean) => {
    if (!preferences) return;

    logger.info('Updating show tray icon', { showTrayIcon: checked });

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        show_tray_icon: checked,
      });
      toast.success(
        checked
          ? _(msg`Tray icon enabled`)
          : _(msg`Tray icon disabled. Changes will take effect on restart.`)
      );
    } catch {
      logger.error('Failed to save tray icon preference');
      toast.error(_(msg`Failed to update tray icon setting`));
    }
  };

  const handleStartMinimizedChange = async (checked: boolean) => {
    if (!preferences) return;

    logger.info('Updating start minimized', { startMinimized: checked });

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        start_minimized: checked,
      });
      toast.success(_(msg`Start minimized setting updated`));
    } catch {
      logger.error('Failed to save start minimized preference');
      toast.error(_(msg`Failed to update start minimized setting`));
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection title={_(msg`System Tray`)}>
        <SettingsField
          label={_(msg`Close Button Behavior`)}
          description={_(msg`Choose what happens when you click the window close button`)}
        >
          <Select
            value={preferences?.close_behavior ?? 'minimize_to_tray'}
            onValueChange={(value) => handleCloseBehaviorChange(value as CloseBehavior)}
            disabled={!preferences || savePreferences.isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minimize_to_tray">{_(msg`Minimize to tray`)}</SelectItem>
              <SelectItem value="quit">{_(msg`Quit application`)}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>

        <SettingsField
          label={_(msg`Show Tray Icon`)}
          description={_(
            msg`Display the application icon in the system tray. Requires restart to take effect when disabled.`
          )}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="show-tray-icon"
              checked={preferences?.show_tray_icon ?? true}
              onCheckedChange={handleShowTrayIconChange}
              disabled={!preferences || savePreferences.isPending}
            />
            <Label htmlFor="show-tray-icon" className="text-sm">
              {(preferences?.show_tray_icon ?? true) ? _(msg`Enabled`) : _(msg`Disabled`)}
            </Label>
          </div>
        </SettingsField>

        <SettingsField
          label={_(msg`Start Minimized`)}
          description={_(msg`Start the application minimized to the system tray`)}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="start-minimized"
              checked={preferences?.start_minimized ?? false}
              onCheckedChange={handleStartMinimizedChange}
              disabled={!preferences || savePreferences.isPending}
            />
            <Label htmlFor="start-minimized" className="text-sm">
              {(preferences?.start_minimized ?? false) ? _(msg`Enabled`) : _(msg`Disabled`)}
            </Label>
          </div>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={_(msg`Keyboard Shortcuts`)}>
        <SettingsField
          label={_(msg`Quick Pane Shortcut`)}
          description={_(
            msg`Global keyboard shortcut to toggle the quick pane from any application`
          )}
        >
          <ShortcutPicker
            value={preferences?.quick_pane_shortcut ?? null}
            defaultValue={defaultShortcut ?? 'CommandOrControl+Shift+.'}
            onChange={handleShortcutChange}
            disabled={!preferences || savePreferences.isPending}
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={_(msg`Example Settings`)}>
        <SettingsField
          label={_(msg`Example Text Setting`)}
          description={_(msg`This is an example text input setting (not persisted)`)}
        >
          <Input
            value={exampleText}
            onChange={(e) => setExampleText(e.target.value)}
            placeholder={_(msg`Enter example text`)}
          />
        </SettingsField>

        <SettingsField
          label={_(msg`Example Toggle Setting`)}
          description={_(msg`This is an example switch/toggle setting (not persisted)`)}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="example-toggle"
              checked={exampleToggle}
              onCheckedChange={setExampleToggle}
            />
            <Label htmlFor="example-toggle" className="text-sm">
              {exampleToggle ? _(msg`Enabled`) : _(msg`Disabled`)}
            </Label>
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
