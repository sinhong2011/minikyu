import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import type { AppPreferences } from '@/lib/tauri-bindings';
import { commands } from '@/lib/tauri-bindings';
import { useSavePreferences } from '@/services/preferences';

interface CloudSyncSectionProps {
  preferences: AppPreferences | undefined;
}

export function CloudSyncSection({ preferences }: CloudSyncSectionProps) {
  const { _ } = useLingui();
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

  const updatePreference = <K extends keyof NonNullable<typeof preferences>>(
    key: K,
    value: NonNullable<typeof preferences>[K]
  ) => {
    if (!preferences) return;
    savePreferences.mutate({ ...preferences, [key]: value });
  };

  const handleCsSaveCredentials = async () => {
    if (!csAccessKey.trim() || !csSecretKey.trim()) {
      showToast.error(_(msg`Please enter both access key and secret key`));
      return;
    }
    const result = await commands.cloudSyncSaveCredentials(csAccessKey, csSecretKey);
    if (result.status === 'ok') {
      setCsHasCredentials(true);
      setCsAccessKey('');
      setCsSecretKey('');
      showToast.success(_(msg`Credentials saved`));
    } else {
      showToast.error(result.error);
    }
  };

  const handleCsDeleteCredentials = async () => {
    const result = await commands.cloudSyncDeleteCredentials();
    if (result.status === 'ok') {
      setCsHasCredentials(false);
      setCsHasWebdavCredentials(false);
      showToast.success(_(msg`Credentials removed`));
    }
  };

  const handleCsSaveWebdavPassword = async () => {
    if (!csWebdavPassword.trim()) {
      showToast.error(_(msg`Please enter a password`));
      return;
    }
    const result = await commands.cloudSyncSaveWebdavPassword(csWebdavPassword);
    if (result.status === 'ok') {
      setCsHasWebdavCredentials(true);
      setCsWebdavPassword('');
      showToast.success(_(msg`Credentials saved`));
    } else {
      showToast.error(result.error);
    }
  };

  const handleCsTestConnection = async () => {
    const protocol = preferences?.cloud_sync_protocol ?? 's3';
    setCsTesting(true);
    try {
      if (protocol === 'webdav') {
        if (!csWebdavPassword.trim()) {
          showToast.error(_(msg`Enter credentials to test connection`));
          return;
        }
        const result = await commands.cloudSyncTestWebdavConnection(
          preferences?.cloud_sync_webdav_url ?? '',
          preferences?.cloud_sync_webdav_username ?? '',
          csWebdavPassword
        );
        if (result.status === 'ok') {
          showToast.success(_(msg`Connection successful`));
        } else {
          showToast.error(result.error);
        }
      } else {
        if (!csAccessKey.trim() || !csSecretKey.trim()) {
          showToast.error(_(msg`Enter credentials to test connection`));
          return;
        }
        const result = await commands.cloudSyncTestConnection(
          preferences?.cloud_sync_endpoint ?? '',
          preferences?.cloud_sync_bucket ?? '',
          preferences?.cloud_sync_region ?? 'auto',
          csAccessKey,
          csSecretKey
        );
        if (result.status === 'ok') {
          showToast.success(_(msg`Connection successful`));
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
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{_(msg`Protocol`)}</Label>
                <Select
                  value={protocol}
                  onValueChange={(value) => updatePreference('cloud_sync_protocol', value)}
                >
                  <SelectTrigger className="h-8 text-sm">
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
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        {_(msg`Endpoint URL`)}
                      </Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="https://s3.amazonaws.com"
                        value={preferences?.cloud_sync_endpoint ?? ''}
                        onChange={(e) =>
                          updatePreference('cloud_sync_endpoint', e.target.value || null)
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{_(msg`Bucket`)}</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="my-bucket"
                          value={preferences?.cloud_sync_bucket ?? ''}
                          onChange={(e) =>
                            updatePreference('cloud_sync_bucket', e.target.value || null)
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{_(msg`Region`)}</Label>
                        <Input
                          className="h-8 text-sm"
                          value={preferences?.cloud_sync_region ?? 'auto'}
                          onChange={(e) =>
                            updatePreference('cloud_sync_region', e.target.value || 'auto')
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{_(msg`Object Key`)}</Label>
                      <Input
                        className="h-8 text-sm"
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
                            <Input
                              className="h-8 text-sm"
                              type="password"
                              value={csAccessKey}
                              onChange={(e) => setCsAccessKey(e.target.value)}
                              placeholder={_(msg`Access Key ID`)}
                            />
                            <Input
                              className="h-8 text-sm"
                              type="password"
                              value={csSecretKey}
                              onChange={(e) => setCsSecretKey(e.target.value)}
                              placeholder={_(msg`Secret Access Key`)}
                            />
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={handleCsSaveCredentials}
                            >
                              {_(msg`Save Credentials`)}
                            </Button>
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
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{_(msg`WebDAV URL`)}</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="https://dav.example.com/remote.php/dav/files/user"
                        value={preferences?.cloud_sync_webdav_url ?? ''}
                        onChange={(e) =>
                          updatePreference('cloud_sync_webdav_url', e.target.value || null)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{_(msg`Username`)}</Label>
                      <Input
                        className="h-8 text-sm"
                        value={preferences?.cloud_sync_webdav_username ?? ''}
                        onChange={(e) =>
                          updatePreference('cloud_sync_webdav_username', e.target.value || null)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{_(msg`File Path`)}</Label>
                      <Input
                        className="h-8 text-sm"
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
                            <Input
                              className="h-8 text-sm"
                              type="password"
                              value={csWebdavPassword}
                              onChange={(e) => setCsWebdavPassword(e.target.value)}
                              placeholder={_(msg`Password`)}
                            />
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={handleCsSaveWebdavPassword}
                            >
                              {_(msg`Save Credentials`)}
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleCsTestConnection}
                  disabled={csTesting || (protocol === 's3' ? !csAccessKey : !csWebdavPassword)}
                >
                  {csTesting ? _(msg`Testing...`) : _(msg`Test Connection`)}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleCsPush}
                  disabled={
                    csPushing ||
                    !isEnabled ||
                    (protocol === 's3' ? !csHasCredentials : !csHasWebdavCredentials)
                  }
                >
                  {csPushing ? _(msg`Pushing...`) : _(msg`Push Now`)}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleCsPull}
                  disabled={
                    csPulling || (protocol === 's3' ? !csHasCredentials : !csHasWebdavCredentials)
                  }
                >
                  {csPulling ? _(msg`Pulling...`) : _(msg`Pull Now`)}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
