import {
  Copy01Icon,
  Delete02Icon,
  Download04Icon,
  FolderOpenIcon,
  RecycleIcon,
  Upload04Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useQueryClient } from '@tanstack/react-query';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { arch, version as osVersion, platform } from '@tauri-apps/plugin-os';
import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showToast } from '@/components/ui/sonner';
import { useClipboard } from '@/hooks/use-clipboard';
import { logger } from '@/lib/logger';
import type { AppPreferences } from '@/lib/tauri-bindings';
import { commands } from '@/lib/tauri-bindings';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { useAccountStore } from '@/store/account-store';
import { useReaderStore } from '@/store/reader-store';
import { useSyncStore } from '@/store/sync-store';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';

const LOG_LEVELS = ['error', 'warn', 'info', 'debug', 'trace'] as const;

export function AdvancedPane() {
  const { _ } = useLingui();
  const queryClient = useQueryClient();
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();
  const { copy, copied } = useClipboard();
  const [clearingData, setClearingData] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ── Clear local data ──────────────────────────────────────────────────

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

  // ── Reset preferences to defaults ─────────────────────────────────────

  const handleResetPreferences = async () => {
    if (resetting) return;

    setResetting(true);
    try {
      const defaults: AppPreferences = {
        theme: 'system',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        quick_pane_shortcut: null,
        language: null,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        close_behavior: 'minimize_to_tray',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        show_tray_icon: true,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        start_minimized: false,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_font_size: 16,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_line_width: 65,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_line_height: 1.75,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_font_family: 'sans-serif',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_theme: 'default',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_code_theme: 'auto',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_chinese_conversion: 's2tw',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_bionic_reading: false,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_status_bar: false,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_custom_conversions: [],
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_display_mode: 'bilingual',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_trigger_mode: 'manual',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_route_mode: 'engine_first',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_target_language: null,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_primary_engine: 'deepl',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_engine_fallbacks: ['google_translate'],
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_llm_fallbacks: [],
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_apple_fallback_enabled: false,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_provider_settings: {},
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_auto_enabled: false,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_excluded_feed_ids: [],
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_excluded_category_ids: [],
        // biome-ignore lint/style/useNamingConvention: preferences field name
        image_download_path: null,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        video_download_path: null,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        ai_summary_auto_enabled: false,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        ai_summary_custom_prompt: null,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        ai_summary_provider: null,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        ai_summary_model: null,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        ai_summary_max_text_length: 100000,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        player_display_mode: 'FloatingWindow',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        keyboard_shortcuts: {},
        // biome-ignore lint/style/useNamingConvention: preferences field name
        log_level: 'info',
      };

      await savePreferences.mutateAsync(defaults);
      logger.setLogLevel('info');
      setResetDialogOpen(false);
      showToast.success(_(msg`Preferences reset to defaults`));
    } catch (error) {
      logger.error('Failed to reset preferences', { error });
      showToast.error(
        _(msg`Failed to reset preferences`),
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setResetting(false);
    }
  };

  // ── Export preferences ────────────────────────────────────────────────

  const handleExportPreferences = async () => {
    if (!preferences) return;

    try {
      const date = new Date().toISOString().split('T')[0];
      const filePath = await saveDialog({
        title: _(msg`Export Preferences`),
        defaultPath: `minikyu-preferences-${date}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (!filePath) return;

      await writeTextFile(filePath, JSON.stringify(preferences, null, 2));
      showToast.success(_(msg`Preferences exported successfully`));
    } catch (error) {
      logger.error('Failed to export preferences', { error });
      showToast.error(
        _(msg`Failed to export preferences`),
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  // ── Import preferences ────────────────────────────────────────────────

  const handleImportPreferences = async () => {
    try {
      const filePath = await openDialog({
        title: _(msg`Import Preferences`),
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (!filePath) return;

      const contents = await readTextFile(filePath);
      const imported = JSON.parse(contents) as AppPreferences;

      await savePreferences.mutateAsync(imported);

      if (imported.log_level) {
        logger.setLogLevel(imported.log_level as 'trace' | 'debug' | 'info' | 'warn' | 'error');
      }

      showToast.success(
        _(msg`Preferences imported`),
        _(msg`Some changes may require an app restart.`)
      );
    } catch (error) {
      logger.error('Failed to import preferences', { error });
      showToast.error(
        _(msg`Failed to import preferences`),
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  // ── Open data directory ───────────────────────────────────────────────

  const handleOpenDataDirectory = async () => {
    try {
      const result = await commands.openDataDirectory();
      if (result.status === 'error') {
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Failed to open data directory', { error });
      showToast.error(
        _(msg`Failed to open data directory`),
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  // ── Copy debug info ───────────────────────────────────────────────────

  const handleCopyDebugInfo = async () => {
    try {
      const osName = platform();
      const osArch = arch();
      let osVer = '';
      try {
        osVer = osVersion();
      } catch {
        osVer = 'unknown';
      }

      const lines = [
        `Minikyu: ${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown'}`,
        `OS: ${osName} ${osVer} (${osArch})`,
        `Locale: ${navigator.language}`,
        `Theme: ${preferences?.theme ?? 'unknown'}`,
        `Log level: ${preferences?.log_level ?? 'info'}`,
      ];

      const success = await copy(lines.join('\n'));
      if (success) {
        showToast.success(_(msg`Debug info copied to clipboard`));
      }
    } catch (error) {
      logger.error('Failed to copy debug info', { error });
      showToast.error(_(msg`Failed to copy debug info`));
    }
  };

  // ── Log level change ──────────────────────────────────────────────────

  const handleLogLevelChange = async (value: string) => {
    if (!preferences) return;

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        log_level: value,
      });
      logger.setLogLevel(value as 'trace' | 'debug' | 'info' | 'warn' | 'error');
      showToast.success(_(msg`Log level updated`));
    } catch {
      logger.error('Failed to save log level');
      showToast.error(_(msg`Failed to update log level`));
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Export / Import ─────────────────────────────────────────── */}
      <SettingsSection title={_(msg`Preferences Backup`)}>
        <SettingsField
          label={_(msg`Export preferences`)}
          description={_(msg`Save your current settings to a JSON file for backup or migration.`)}
        >
          <Button
            variant="outline"
            onClick={handleExportPreferences}
            disabled={!preferences || savePreferences.isPending}
          >
            <HugeiconsIcon icon={Download04Icon} className="size-4" />
            {_(msg`Export`)}
          </Button>
        </SettingsField>

        <SettingsField
          label={_(msg`Import preferences`)}
          description={_(msg`Restore settings from a previously exported JSON file.`)}
        >
          <Button
            variant="outline"
            onClick={handleImportPreferences}
            disabled={savePreferences.isPending}
          >
            <HugeiconsIcon icon={Upload04Icon} className="size-4" />
            {_(msg`Import`)}
          </Button>
        </SettingsField>
      </SettingsSection>

      {/* ── Diagnostics ────────────────────────────────────────────── */}
      <SettingsSection title={_(msg`Diagnostics`)}>
        <SettingsField
          label={_(msg`Open data directory`)}
          description={_(msg`Open the folder where Minikyu stores local data.`)}
        >
          <Button variant="outline" onClick={handleOpenDataDirectory}>
            <HugeiconsIcon icon={FolderOpenIcon} className="size-4" />
            {_(msg`Open`)}
          </Button>
        </SettingsField>

        <SettingsField
          label={_(msg`Copy debug info`)}
          description={_(msg`Copy app version, OS, and environment details for bug reports.`)}
        >
          <Button variant="outline" onClick={handleCopyDebugInfo}>
            <HugeiconsIcon icon={Copy01Icon} className="size-4" />
            {copied ? _(msg`Copied!`) : _(msg`Copy`)}
          </Button>
        </SettingsField>

        <SettingsField
          label={_(msg`Log level`)}
          description={_(
            msg`Control the verbosity of frontend log output. More verbose levels include all levels above them.`
          )}
        >
          <Select
            value={preferences?.log_level ?? 'info'}
            onValueChange={handleLogLevelChange}
            disabled={!preferences || savePreferences.isPending}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOG_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>

      {/* ── Data ───────────────────────────────────────────────────── */}
      <SettingsSection title={_(msg`Data`)}>
        <SettingsField
          label={_(msg`Reset preferences`)}
          description={_(
            msg`Restore all settings to their factory defaults. Your data and accounts are not affected.`
          )}
        >
          <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <AlertDialogTrigger
              render={
                <Button variant="outline" disabled={resetting}>
                  <HugeiconsIcon icon={RecycleIcon} className="size-4" />
                  {resetting ? _(msg`Resetting...`) : _(msg`Reset`)}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{_(msg`Reset preferences?`)}</AlertDialogTitle>
                <AlertDialogDescription>
                  {_(
                    msg`All settings will be restored to their defaults. Your data and accounts will not be affected.`
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{_(msg`Cancel`)}</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetPreferences} disabled={resetting}>
                  {_(msg`Reset`)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SettingsField>

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
                  <HugeiconsIcon icon={Delete02Icon} className="size-4" />
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
