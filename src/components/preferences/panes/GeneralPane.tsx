import { FolderOpenIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { open } from '@tauri-apps/plugin-dialog';
import { Switch } from '@/components/animate-ui/components/base/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import type { CloseBehavior } from '@/lib/tauri-bindings';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';

export function GeneralPane() {
  const { _ } = useLingui();

  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();

  const handleCloseBehaviorChange = async (value: CloseBehavior) => {
    if (!preferences) return;

    logger.info('Updating close behavior', { behavior: value });

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        close_behavior: value,
      });
      showToast.success(_(msg`Close behavior updated`));
    } catch {
      logger.error('Failed to save close behavior');
      showToast.error(_(msg`Failed to update close behavior`));
    }
  };

  const handleShowTrayIconChange = async (checked: boolean) => {
    if (!preferences) return;

    logger.info('Updating show tray icon', { showTrayIcon: checked });

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        show_tray_icon: checked,
      });
      showToast.success(
        checked
          ? _(msg`Tray icon enabled`)
          : _(msg`Tray icon disabled. Changes will take effect on restart.`)
      );
    } catch {
      logger.error('Failed to save tray icon preference');
      showToast.error(_(msg`Failed to update tray icon setting`));
    }
  };

  const handleStartMinimizedChange = async (checked: boolean) => {
    if (!preferences) return;

    logger.info('Updating start minimized', { startMinimized: checked });

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        start_minimized: checked,
      });
      showToast.success(_(msg`Start minimized setting updated`));
    } catch {
      logger.error('Failed to save start minimized preference');
      showToast.error(_(msg`Failed to update start minimized setting`));
    }
  };

  const handleBrowseFolder = async (type: 'image' | 'video') => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title:
          type === 'image'
            ? _(msg`Select Image Download Folder`)
            : _(msg`Select Video Download Folder`),
      });

      if (selected) {
        const folderPath = selected as string;
        if (type === 'image') {
          await handleImagePathChange(folderPath);
        } else {
          await handleVideoPathChange(folderPath);
        }
      }
    } catch {
      logger.error('Failed to open folder dialog');
      showToast.error(_(msg`Failed to select folder`));
    }
  };

  const handleImagePathChange = async (newPath: string) => {
    if (!preferences) return;

    logger.info('Updating image download path', { path: newPath });

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        image_download_path: newPath || null,
      });
      showToast.success(_(msg`Image download path updated`));
    } catch {
      logger.error('Failed to save image download path');
      showToast.error(_(msg`Failed to update image download path`));
    }
  };

  const handleVideoPathChange = async (newPath: string) => {
    if (!preferences) return;

    logger.info('Updating video download path', { path: newPath });

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        video_download_path: newPath || null,
      });
      showToast.success(_(msg`Video download path updated`));
    } catch {
      logger.error('Failed to save video download path');
      showToast.error(_(msg`Failed to update video download path`));
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

      <SettingsSection title={_(msg`Download Settings`)}>
        <SettingsField
          label={_(msg`Image Download Path`)}
          description={_(msg`Default folder for saving images. Leave empty to ask every time.`)}
        >
          <div className="flex items-center gap-2">
            <Input
              value={preferences?.image_download_path ?? ''}
              onChange={(e) => handleImagePathChange(e.target.value)}
              placeholder={_(msg`System default (ask every time)`)}
              disabled={!preferences || savePreferences.isPending}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBrowseFolder('image')}
              disabled={!preferences || savePreferences.isPending}
            >
              <HugeiconsIcon icon={FolderOpenIcon} className="h-4 w-4" />
            </Button>
          </div>
        </SettingsField>

        <SettingsField
          label={_(msg`Video Download Path`)}
          description={_(msg`Default folder for saving videos. Leave empty to ask every time.`)}
        >
          <div className="flex items-center gap-2">
            <Input
              value={preferences?.video_download_path ?? ''}
              onChange={(e) => handleVideoPathChange(e.target.value)}
              placeholder={_(msg`System default (ask every time)`)}
              disabled={!preferences || savePreferences.isPending}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBrowseFolder('video')}
              disabled={!preferences || savePreferences.isPending}
            >
              <HugeiconsIcon icon={FolderOpenIcon} className="h-4 w-4" />
            </Button>
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
