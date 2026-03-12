import {
  AlertCircleIcon,
  Copy01Icon,
  Delete02Icon,
  Download04Icon,
  FileDownloadIcon,
  FileUploadIcon,
  RecycleIcon,
  Upload04Icon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { arch, version as osVersion, platform } from '@tauri-apps/plugin-os';
import { useEffect, useMemo, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import type { AppPreferences, LocalDataSize } from '@/lib/tauri-bindings';
import { commands } from '@/lib/tauri-bindings';
import { useActiveAccount } from '@/services/miniflux/accounts';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { useReaderStore } from '@/store/reader-store';
import { useSyncStore } from '@/store/sync-store';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';
import { CloudSyncSection } from './CloudSyncSection';

const LOG_LEVELS = ['error', 'warn', 'info', 'debug', 'trace'] as const;

const LOG_LEVEL_LABELS = {
  error: msg`Error`,
  warn: msg`Warn`,
  info: msg`Info`,
  debug: msg`Debug`,
  trace: msg`Trace`,
} as const;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

const STORAGE_COLORS = [
  'bg-primary/70',
  'bg-blue-500/60',
  'bg-amber-500/50',
  'bg-emerald-500/50',
] as const;

const STORAGE_LABEL_KEYS = {
  database: msg`Database`,
  downloads: msg`Downloads`,
  settings: msg`Settings`,
  recovery: msg`Recovery`,
} as const;

/** Group raw backend file entries into user-meaningful categories. */
function groupStorageCategories(
  files: Array<{ name: string; bytes: number | string; exists: boolean }>
) {
  const sum = (...names: string[]) =>
    files
      .filter((f) => f.exists && names.includes(f.name))
      .reduce((acc, f) => acc + Number(f.bytes), 0);

  return [
    { labelKey: 'database', bytes: sum('Database', 'Database WAL', 'Database SHM') },
    { labelKey: 'downloads', bytes: sum('Downloads') },
    { labelKey: 'settings', bytes: sum('Preferences', 'Reading state') },
    { labelKey: 'recovery', bytes: sum('Recovery files') },
  ]
    .filter((c) => c.bytes > 0)
    .map((c, i) => ({
      ...c,
      label: STORAGE_LABEL_KEYS[c.labelKey as keyof typeof STORAGE_LABEL_KEYS],
      color: STORAGE_COLORS[i % STORAGE_COLORS.length],
    }));
}

export function AdvancedPane() {
  const { _ } = useLingui();
  const queryClient = useQueryClient();
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();
  const { copy, copied } = useClipboard();
  const { data: activeAccount } = useActiveAccount();
  const [clearingData, setClearingData] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [factoryResetDialogOpen, setFactoryResetDialogOpen] = useState(false);
  const [factoryResetting, setFactoryResetting] = useState(false);
  const [factoryResetConfirmText, setFactoryResetConfirmText] = useState('');

  const { data: dataSize } = useQuery({
    queryKey: ['local-data-size'],
    queryFn: async (): Promise<LocalDataSize> => {
      const result = await commands.getLocalDataSize();
      if (result.status === 'error') throw new Error(result.error);
      return result.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // ── Clear local data ──────────────────────────────────────────────────

  const handleClearLocalData = async () => {
    if (clearingData) return;

    setClearingData(true);
    try {
      const result = await commands.clearLocalData();
      if (result.status === 'error') {
        throw new Error(result.error);
      }

      queryClient.clear();
      useReaderStore.getState().resetReaderState();
      useSyncStore.getState().setSyncing(false);
      useSyncStore.getState().setError(null);
      useSyncStore.getState().setLastSyncedAt(null);
      useSyncStore.getState().setCurrentStage('idle');

      setClearDialogOpen(false);
      showToast.success(
        _(msg`Account data cleared`),
        _(msg`Synced data for the current account has been removed.`)
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
        reader_translation_exclusions: {},
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

  // ── Factory reset ────────────────────────────────────────────────────

  const handleFactoryReset = async () => {
    if (factoryResetting) return;

    setFactoryResetting(true);
    try {
      const result = await commands.factoryReset();
      if (result.status === 'error') {
        throw new Error(result.error);
      }

      queryClient.clear();
      useReaderStore.getState().resetReaderState();
      useSyncStore.getState().setSyncing(false);
      useSyncStore.getState().setError(null);
      useSyncStore.getState().setLastSyncedAt(null);
      useSyncStore.getState().setCurrentStage('idle');

      setFactoryResetDialogOpen(false);
      setFactoryResetConfirmText('');
      showToast.success(
        _(msg`Factory reset complete`),
        _(msg`All data has been deleted. The app has been reset to its initial state.`)
      );
    } catch (error) {
      logger.error('Factory reset failed', { error });
      showToast.error(
        _(msg`Factory reset failed`),
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setFactoryResetting(false);
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

  // ── OPML export/import ──────────────────────────────────────────────

  const handleExportOpml = async () => {
    try {
      const date = new Date().toISOString().split('T')[0];
      const filePath = await saveDialog({
        title: _(msg`Export OPML`),
        defaultPath: `miniflux-feeds-${date}.opml`,
        filters: [
          { name: 'OPML', extensions: ['opml'] },
          { name: 'XML', extensions: ['xml'] },
        ],
      });
      if (!filePath) return;

      const result = await commands.exportOpml();
      if (result.status === 'error') {
        showToast.error(_(msg`Failed to export OPML`), result.error);
        return;
      }

      await writeTextFile(filePath, result.data);
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      showToast.success(_(msg`OPML exported successfully`));
    } catch (error) {
      logger.error('Failed to export OPML', { error });
      showToast.error(
        _(msg`Failed to export OPML`),
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleImportOpml = async () => {
    try {
      const filePath = await openDialog({
        title: _(msg`Import OPML`),
        multiple: false,
        filters: [
          { name: 'OPML', extensions: ['opml'] },
          { name: 'XML', extensions: ['xml'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (!filePath) return;

      const opmlContent = await readTextFile(filePath);
      const result = await commands.importOpml(opmlContent);
      if (result.status === 'error') {
        showToast.error(_(msg`Failed to import OPML`), result.error);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      showToast.success(_(msg`OPML imported successfully`));
    } catch (error) {
      logger.error('Failed to import OPML', { error });
      showToast.error(
        _(msg`Failed to import OPML`),
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

        {/* Cloud Sync */}
        <CloudSyncSection preferences={preferences} />
      </SettingsSection>

      {/* ── OPML ───────────────────────────────────────────────────── */}
      <SettingsSection title={_(msg`OPML`)}>
        <SettingsField
          label={_(msg`Export OPML`)}
          description={_(msg`Export your feeds as an OPML file for backup or migration.`)}
        >
          <Button variant="outline" onClick={handleExportOpml}>
            <HugeiconsIcon icon={FileDownloadIcon} className="size-4" />
            {_(msg`Export`)}
          </Button>
        </SettingsField>

        <SettingsField
          label={_(msg`Import OPML`)}
          description={_(msg`Import feeds from an OPML file.`)}
        >
          <Button variant="outline" onClick={handleImportOpml}>
            <HugeiconsIcon icon={FileUploadIcon} className="size-4" />
            {_(msg`Import`)}
          </Button>
        </SettingsField>
      </SettingsSection>

      {/* ── Storage & Data ────────────────────────────────────────── */}
      <SettingsSection title={_(msg`Storage & Data`)}>
        {dataSize && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">{_(msg`Local storage used`)}</span>
              <span className="text-lg font-semibold font-mono tabular-nums">
                {formatBytes(Number(dataSize.total_bytes))}
              </span>
            </div>
            {(() => {
              const categories = groupStorageCategories(dataSize.files);
              return (
                <>
                  <div className="mt-3 flex gap-1 overflow-hidden rounded-full bg-muted">
                    {categories.map((cat) => {
                      const pct = (cat.bytes / Number(dataSize.total_bytes)) * 100;
                      return (
                        <div
                          key={cat.labelKey}
                          className={`h-2 ${cat.color} first:rounded-l-full last:rounded-r-full transition-all`}
                          style={{ width: `${Math.max(pct, 3)}%` }}
                          title={`${_(cat.label)}: ${formatBytes(cat.bytes)}`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                    {categories.map((cat) => (
                      <span
                        key={cat.labelKey}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <span className={`inline-block size-2 rounded-full ${cat.color}`} />
                        {_(cat.label)}{' '}
                        <span className="font-mono tabular-nums">{formatBytes(cat.bytes)}</span>
                      </span>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Tier 1: Clear account data (least destructive) */}
        <SettingsField
          label={
            activeAccount ? (
              <span>
                {_(msg`Clear data for`)}{' '}
                <Badge variant="secondary" className="text-xs font-normal">
                  <HugeiconsIcon icon={UserCircleIcon} className="size-3" />
                  {activeAccount.username}
                </Badge>
              </span>
            ) : (
              _(msg`Clear account data`)
            )
          }
          description={_(
            msg`Removes synced entries, feeds, and categories for the current account. Other accounts and preferences are not affected.`
          )}
        >
          <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
            <AlertDialogTrigger
              render={
                <Button variant="outline" disabled={clearingData || !activeAccount}>
                  <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                  {clearingData ? _(msg`Clearing...`) : _(msg`Clear data`)}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {_(msg`Clear data for ${activeAccount?.username ?? ''}?`)}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {_(
                    msg`This will remove synced entries, feeds, categories, and sync history for this account. Other accounts and app preferences are not affected.`
                  )}
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

        {/* Tier 2: Reset preferences (medium) */}
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

        {/* Tier 3: Factory reset (most destructive, type-to-confirm) */}
        <SettingsField
          label={_(msg`Factory reset`)}
          description={_(
            msg`Permanently deletes everything — all accounts, synced data, preferences, downloads, and credentials. This cannot be undone.`
          )}
        >
          <AlertDialog
            open={factoryResetDialogOpen}
            onOpenChange={(open) => {
              setFactoryResetDialogOpen(open);
              if (!open) setFactoryResetConfirmText('');
            }}
          >
            <AlertDialogTrigger
              render={
                <Button variant="destructive" disabled={factoryResetting}>
                  <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
                  {factoryResetting ? _(msg`Resetting...`) : _(msg`Factory reset`)}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{_(msg`Factory reset?`)}</AlertDialogTitle>
                <AlertDialogDescription>
                  {_(
                    msg`This will permanently delete all accounts, synced data, preferences, downloads, and saved credentials. The app will return to its initial state.`
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="px-6 pb-2">
                <label className="text-sm text-muted-foreground" htmlFor="factory-reset-confirm">
                  {_(msg`Type RESET to confirm`)}
                </label>
                <Input
                  id="factory-reset-confirm"
                  className="mt-1.5"
                  placeholder="RESET"
                  value={factoryResetConfirmText}
                  onChange={(e) => setFactoryResetConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>{_(msg`Cancel`)}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleFactoryReset}
                  variant="destructive"
                  disabled={factoryResetConfirmText !== 'RESET' || factoryResetting}
                >
                  {_(msg`Delete everything`)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SettingsField>
      </SettingsSection>

      {/* ── Diagnostics (dev only) ─────────────────────────────────── */}
      {import.meta.env.DEV && (
        <SettingsSection title={_(msg`Diagnostics`)}>
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
                    {_(LOG_LEVEL_LABELS[level])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsSection>
      )}

      {/* ── Settings JSON Preview ──────────────────────────────────── */}
      {preferences && <SettingsJsonPreview preferences={preferences} />}
    </div>
  );
}

function SettingsJsonPreview({ preferences }: { preferences: AppPreferences }) {
  const { _ } = useLingui();
  const { copy, copied } = useClipboard();
  const [expanded, setExpanded] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const json = useMemo(() => JSON.stringify(preferences, null, 2), [preferences]);
  const isDark = document.documentElement.classList.contains('dark');

  useEffect(() => {
    let cancelled = false;
    import('@/lib/shiki-highlight').then(({ highlightCodeWithShiki }) =>
      highlightCodeWithShiki({
        code: json,
        language: 'json',
        isDarkMode: isDark,
        theme: 'tokyo-night',
      }).then((html) => {
        if (!cancelled && html) setHighlightedHtml(html);
      })
    );
    return () => {
      cancelled = true;
    };
  }, [json, isDark]);

  return (
    <SettingsSection title={_(msg`Settings Preview`)}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{_(msg`Current preferences as JSON`)}</p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => copy(json)}
            >
              <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
              {copied ? _(msg`Copied!`) : _(msg`Copy`)}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? _(msg`Collapse`) : _(msg`Expand`)}
            </Button>
          </div>
        </div>
        {highlightedHtml ? (
          <div
            data-no-ui-font=""
            className={`overflow-auto rounded-lg border font-mono text-[11px] leading-relaxed [&_pre]:!p-3 [&_pre]:!m-0 [&_pre]:!rounded-lg [&_pre]:!font-mono ${
              expanded ? 'max-h-[60vh]' : 'max-h-48'
            }`}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted shiki output from local preferences JSON
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre
            data-no-ui-font=""
            className={`overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-foreground/80 ${
              expanded ? 'max-h-[60vh]' : 'max-h-48'
            }`}
          >
            {json}
          </pre>
        )}
      </div>
    </SettingsSection>
  );
}
