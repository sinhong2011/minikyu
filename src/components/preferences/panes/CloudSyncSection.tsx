import { Loading02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useQueryClient } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showToast } from '@/components/ui/sonner';
import { Switch } from '@/components/ui/switch';
import type { AppPreferences } from '@/lib/tauri-bindings';
import { commands } from '@/lib/tauri-bindings';
import { preferencesQueryKeys, useSavePreferences } from '@/services/preferences';

function formatLastSynced(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHrs = Math.floor(diffMs / 3_600_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface CloudSyncSectionProps {
  preferences: AppPreferences | undefined;
}

export function CloudSyncSection({ preferences }: CloudSyncSectionProps) {
  const { _ } = useLingui();
  const queryClient = useQueryClient();
  const savePreferences = useSavePreferences();

  const [csAccessKey, setCsAccessKey] = useState('');
  const [csSecretKey, setCsSecretKey] = useState('');
  const [csHasCredentials, setCsHasCredentials] = useState(false);
  const [csWebdavPassword, setCsWebdavPassword] = useState('');
  const [csHasWebdavCredentials, setCsHasWebdavCredentials] = useState(false);
  const [csTesting, setCsTesting] = useState(false);
  const [csPushing, setCsPushing] = useState(false);
  const [csPulling, setCsPulling] = useState(false);

  useEffect(() => {
    commands.cloudSyncHasCredentials().then((result) => {
      if (result.status === 'ok') setCsHasCredentials(result.data);
    });
    commands.cloudSyncHasWebdavCredentials().then((result) => {
      if (result.status === 'ok') setCsHasWebdavCredentials(result.data);
    });
  }, []);

  // Update last sync time when debounced push completes in the background
  useEffect(() => {
    const unlisten = listen('cloud-sync-pushed', () => {
      queryClient.setQueryData(preferencesQueryKeys.preferences(), (old: AppPreferences) => ({
        ...old,
        cloud_sync_last_synced: new Date().toISOString(),
      }));
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);

  const updatePreference = <K extends keyof NonNullable<typeof preferences>>(
    key: K,
    value: NonNullable<typeof preferences>[K]
  ) => {
    if (!preferences) return;
    savePreferences.mutate({ ...preferences, [key]: value });
  };

  const handleCsDeleteCredentials = async () => {
    const result = await commands.cloudSyncDeleteCredentials();
    if (result.status === 'ok') {
      setCsHasCredentials(false);
      setCsHasWebdavCredentials(false);
      showToast.success(_(msg`Credentials removed`));
    }
  };

  const handleCsTestConnection = async () => {
    const protocol = preferences?.cloud_sync_protocol ?? 's3';
    setCsTesting(true);
    try {
      if (protocol === 'webdav') {
        const result = await commands.cloudSyncTestWebdavConnection(
          preferences?.cloud_sync_webdav_url ?? '',
          preferences?.cloud_sync_webdav_username ?? '',
          csWebdavPassword
        );
        if (result.status === 'ok') {
          if (csWebdavPassword.trim()) {
            await commands.cloudSyncSaveWebdavPassword(csWebdavPassword);
            setCsHasWebdavCredentials(true);
            setCsWebdavPassword('');
          }
          showToast.success(
            csWebdavPassword.trim()
              ? _(msg`Connection successful, credentials saved`)
              : _(msg`Connection successful`)
          );
        } else {
          showToast.error(result.error);
        }
      } else {
        const result = await commands.cloudSyncTestConnection(
          preferences?.cloud_sync_endpoint ?? '',
          preferences?.cloud_sync_bucket ?? '',
          preferences?.cloud_sync_region ?? 'auto',
          csAccessKey,
          csSecretKey
        );
        if (result.status === 'ok') {
          if (csAccessKey.trim() && csSecretKey.trim()) {
            await commands.cloudSyncSaveCredentials(csAccessKey, csSecretKey);
            setCsHasCredentials(true);
            setCsAccessKey('');
            setCsSecretKey('');
          }
          showToast.success(
            csAccessKey.trim()
              ? _(msg`Connection successful, credentials saved`)
              : _(msg`Connection successful`)
          );
        } else {
          showToast.error(result.error);
        }
      }
    } finally {
      setCsTesting(false);
    }
  };

  const handleCsPush = async () => {
    setCsPushing(true);
    try {
      const result = await commands.cloudSyncPush();
      if (result.status === 'ok') {
        showToast.success(_(msg`Preferences pushed to cloud`));
        queryClient.setQueryData(preferencesQueryKeys.preferences(), (old: AppPreferences) => ({
          ...old,
          cloud_sync_last_synced: new Date().toISOString(),
        }));
      } else {
        showToast.error(result.error);
      }
    } finally {
      setCsPushing(false);
    }
  };

  const handleCsPull = async () => {
    setCsPulling(true);
    try {
      const result = await commands.cloudSyncPull();
      if (result.status === 'ok') {
        showToast.success(_(msg`Preferences restored from cloud`));
        window.location.reload();
      } else {
        showToast.error(result.error);
      }
    } finally {
      setCsPulling(false);
    }
  };

  const protocol = preferences?.cloud_sync_protocol ?? 's3';
  const isEnabled = preferences?.cloud_sync_enabled;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{_(msg`Cloud Sync`)}</Label>
          <p className="text-sm text-muted-foreground">
            {_(msg`Sync preferences via S3 or WebDAV`)}
          </p>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => updatePreference('cloud_sync_enabled', checked)}
        />
      </div>

      <AnimatePresence initial={false}>
        {isEnabled && (
          <motion.div
            key="cloud-sync-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              {/* Protocol selector */}
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{_(msg`Protocol`)}</Label>
                <Select
                  value={protocol}
                  onValueChange={(value) => updatePreference('cloud_sync_protocol', value)}
                >
                  <SelectTrigger className="h-8 text-sm w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="s3">S3</SelectItem>
                    <SelectItem value="webdav">WebDAV</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Protocol-specific fields with animated transition */}
              <AnimatePresence mode="wait" initial={false}>
                {protocol === 's3' ? (
                  <motion.div
                    key="s3-fields"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs text-muted-foreground shrink-0">
                        {_(msg`Endpoint URL`)}
                      </Label>
                      <Input
                        className="h-8 text-sm max-w-[60%]"
                        placeholder="https://s3.amazonaws.com"
                        value={preferences?.cloud_sync_endpoint ?? ''}
                        onChange={(e) =>
                          updatePreference('cloud_sync_endpoint', e.target.value || null)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs text-muted-foreground shrink-0">
                        {_(msg`Bucket`)}
                      </Label>
                      <Input
                        className="h-8 text-sm max-w-[60%]"
                        placeholder="my-bucket"
                        value={preferences?.cloud_sync_bucket ?? ''}
                        onChange={(e) =>
                          updatePreference('cloud_sync_bucket', e.target.value || null)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs text-muted-foreground shrink-0">
                        {_(msg`Region`)}
                      </Label>
                      <Input
                        className="h-8 text-sm max-w-[60%]"
                        value={preferences?.cloud_sync_region ?? 'auto'}
                        onChange={(e) =>
                          updatePreference('cloud_sync_region', e.target.value || 'auto')
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs text-muted-foreground shrink-0">
                        {_(msg`Object Key`)}
                      </Label>
                      <Input
                        className="h-8 text-sm max-w-[60%]"
                        value={
                          preferences?.cloud_sync_object_key ?? 'minikyu/preferences-sync.json'
                        }
                        onChange={(e) =>
                          updatePreference(
                            'cloud_sync_object_key',
                            e.target.value || 'minikyu/preferences-sync.json'
                          )
                        }
                      />
                    </div>
                    {/* S3 Credentials */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          {_(msg`Credentials`)}
                        </Label>
                        {csHasCredentials && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={handleCsDeleteCredentials}
                          >
                            {_(msg`Remove saved credentials`)}
                          </Button>
                        )}
                      </div>
                      <AnimatePresence mode="wait" initial={false}>
                        {csHasCredentials ? (
                          <motion.p
                            key="s3-creds-saved"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-xs text-muted-foreground"
                          >
                            {_(msg`Credentials are saved in your system keyring.`)}
                          </motion.p>
                        ) : (
                          <motion.div
                            key="s3-creds-form"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-2"
                          >
                            <PasswordInput
                              className="h-8 text-sm"
                              value={csAccessKey}
                              onChange={(e) => setCsAccessKey(e.target.value)}
                              placeholder={_(msg`Access Key ID`)}
                            />
                            <PasswordInput
                              className="h-8 text-sm"
                              value={csSecretKey}
                              onChange={(e) => setCsSecretKey(e.target.value)}
                              placeholder={_(msg`Secret Access Key`)}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="webdav-fields"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs text-muted-foreground shrink-0">
                        {_(msg`WebDAV URL`)}
                      </Label>
                      <Input
                        className="h-8 text-sm max-w-[60%]"
                        placeholder="https://dav.example.com/remote.php/dav/files/user"
                        value={preferences?.cloud_sync_webdav_url ?? ''}
                        onChange={(e) =>
                          updatePreference('cloud_sync_webdav_url', e.target.value || null)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs text-muted-foreground shrink-0">
                        {_(msg`Username`)}
                      </Label>
                      <Input
                        className="h-8 text-sm max-w-[60%]"
                        value={preferences?.cloud_sync_webdav_username ?? ''}
                        onChange={(e) =>
                          updatePreference('cloud_sync_webdav_username', e.target.value || null)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs text-muted-foreground shrink-0">
                        {_(msg`File Path`)}
                      </Label>
                      <Input
                        className="h-8 text-sm max-w-[60%]"
                        value={
                          preferences?.cloud_sync_webdav_path ?? '/minikyu/preferences-sync.json'
                        }
                        onChange={(e) =>
                          updatePreference(
                            'cloud_sync_webdav_path',
                            e.target.value || '/minikyu/preferences-sync.json'
                          )
                        }
                      />
                    </div>
                    {/* WebDAV Password */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">{_(msg`Password`)}</Label>
                        {csHasWebdavCredentials && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={handleCsDeleteCredentials}
                          >
                            {_(msg`Remove saved credentials`)}
                          </Button>
                        )}
                      </div>
                      <AnimatePresence mode="wait" initial={false}>
                        {csHasWebdavCredentials ? (
                          <motion.p
                            key="webdav-creds-saved"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-xs text-muted-foreground"
                          >
                            {_(msg`Credentials are saved in your system keyring.`)}
                          </motion.p>
                        ) : (
                          <motion.div
                            key="webdav-creds-form"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-2"
                          >
                            <PasswordInput
                              className="h-8 text-sm"
                              value={csWebdavPassword}
                              onChange={(e) => setCsWebdavPassword(e.target.value)}
                              placeholder={_(msg`Password`)}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Auto-pull on startup */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {_(msg`Auto-pull on startup`)}
                  </Label>
                  <p className="text-[11px] text-muted-foreground/70">
                    {_(msg`Restore settings from cloud when the app opens`)}
                  </p>
                </div>
                <Switch
                  checked={preferences?.cloud_sync_auto_pull}
                  onCheckedChange={(checked) => updatePreference('cloud_sync_auto_pull', checked)}
                />
              </div>

              {/* Last sync time */}
              <p className="text-[11px] text-muted-foreground/70">
                {_(msg`Last sync:`)}{' '}
                {preferences?.cloud_sync_last_synced
                  ? formatLastSynced(preferences.cloud_sync_last_synced)
                  : _(msg`Never`)}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <ActionButton
                  loading={csTesting}
                  onClick={handleCsTestConnection}
                  label={_(msg`Test Connection`)}
                  loadingLabel={_(msg`Testing...`)}
                />
                <ActionButton
                  loading={csPushing}
                  onClick={handleCsPush}
                  disabled={
                    !isEnabled || (protocol === 's3' ? !csHasCredentials : !csHasWebdavCredentials)
                  }
                  label={_(msg`Push Now`)}
                  loadingLabel={_(msg`Pushing...`)}
                />
                <ActionButton
                  loading={csPulling}
                  onClick={handleCsPull}
                  disabled={protocol === 's3' ? !csHasCredentials : !csHasWebdavCredentials}
                  label={_(msg`Pull Now`)}
                  loadingLabel={_(msg`Pulling...`)}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionButton({
  loading,
  onClick,
  disabled,
  label,
  loadingLabel,
}: {
  loading: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-xs"
      onClick={onClick}
      disabled={loading || disabled}
    >
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1"
          >
            <HugeiconsIcon icon={Loading02Icon} className="size-3 animate-spin" />
            {loadingLabel}
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
