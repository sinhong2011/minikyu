import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { commands } from '@/lib/tauri-bindings';
import { usePreferences, useSavePreferences } from '@/services/preferences';

export function CloudSyncPane() {
  const { _ } = useLingui();
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();

  // Local state for credential fields (not in preferences)
  const [accessKey, setAccessKey] = React.useState('');
  const [secretKey, setSecretKey] = React.useState('');
  const [hasCredentials, setHasCredentials] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [isPushing, setIsPushing] = React.useState(false);
  const [isPulling, setIsPulling] = React.useState(false);

  // Check if credentials exist on mount
  React.useEffect(() => {
    commands.cloudSyncHasCredentials().then((result) => {
      if (result.status === 'ok') setHasCredentials(result.data);
    });
  }, []);

  if (!preferences) return null;

  const updatePreference = <K extends keyof typeof preferences>(
    key: K,
    value: (typeof preferences)[K]
  ) => {
    savePreferences.mutate({ ...preferences, [key]: value });
  };

  const handleSaveCredentials = async () => {
    if (!accessKey.trim() || !secretKey.trim()) {
      toast.error(_(msg`Please enter both access key and secret key`));
      return;
    }
    const result = await commands.cloudSyncSaveCredentials(accessKey, secretKey);
    if (result.status === 'ok') {
      setHasCredentials(true);
      setAccessKey('');
      setSecretKey('');
      toast.success(_(msg`Credentials saved`));
    } else {
      toast.error(result.error);
    }
  };

  const handleDeleteCredentials = async () => {
    const result = await commands.cloudSyncDeleteCredentials();
    if (result.status === 'ok') {
      setHasCredentials(false);
      toast.success(_(msg`Credentials removed`));
    }
  };

  const handleTestConnection = async () => {
    if (!accessKey.trim() || !secretKey.trim()) {
      toast.error(_(msg`Enter credentials to test connection`));
      return;
    }

    setIsTesting(true);
    try {
      const result = await commands.cloudSyncTestConnection(
        preferences.cloud_sync_endpoint ?? '',
        preferences.cloud_sync_bucket ?? '',
        preferences.cloud_sync_region ?? 'auto',
        accessKey,
        secretKey
      );
      if (result.status === 'ok') {
        toast.success(_(msg`Connection successful`));
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handlePush = async () => {
    setIsPushing(true);
    try {
      const result = await commands.cloudSyncPush();
      if (result.status === 'ok') {
        toast.success(_(msg`Preferences pushed to cloud`));
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    try {
      const result = await commands.cloudSyncPull();
      if (result.status === 'ok') {
        toast.success(_(msg`Preferences restored from cloud`));
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label>{_(msg`Enable Cloud Sync`)}</Label>
          <p className="text-sm text-muted-foreground">
            {_(msg`Automatically sync preferences to S3-compatible storage`)}
          </p>
        </div>
        <Switch
          checked={preferences.cloud_sync_enabled}
          onCheckedChange={(checked) => updatePreference('cloud_sync_enabled', checked)}
        />
      </div>

      {/* Connection settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">{_(msg`Connection`)}</h3>

        <div className="space-y-2">
          <Label>{_(msg`Endpoint URL`)}</Label>
          <Input
            placeholder="https://s3.amazonaws.com"
            value={preferences.cloud_sync_endpoint ?? ''}
            onChange={(e) => updatePreference('cloud_sync_endpoint', e.target.value || null)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{_(msg`Bucket`)}</Label>
            <Input
              placeholder="my-bucket"
              value={preferences.cloud_sync_bucket ?? ''}
              onChange={(e) => updatePreference('cloud_sync_bucket', e.target.value || null)}
            />
          </div>
          <div className="space-y-2">
            <Label>{_(msg`Region`)}</Label>
            <Input
              value={preferences.cloud_sync_region ?? 'auto'}
              onChange={(e) => updatePreference('cloud_sync_region', e.target.value || 'auto')}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{_(msg`Object Key`)}</Label>
          <Input
            value={preferences.cloud_sync_object_key ?? 'minikyu/preferences-sync.json'}
            onChange={(e) =>
              updatePreference(
                'cloud_sync_object_key',
                e.target.value || 'minikyu/preferences-sync.json'
              )
            }
          />
        </div>
      </div>

      {/* Credentials */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{_(msg`Credentials`)}</h3>
          {hasCredentials && (
            <Button variant="ghost" size="sm" onClick={handleDeleteCredentials}>
              {_(msg`Remove saved credentials`)}
            </Button>
          )}
        </div>

        {hasCredentials ? (
          <p className="text-sm text-muted-foreground">
            {_(msg`Credentials are saved in your system keyring.`)}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>{_(msg`Access Key ID`)}</Label>
              <Input
                type="password"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="AKIA..."
              />
            </div>
            <div className="space-y-2">
              <Label>{_(msg`Secret Access Key`)}</Label>
              <Input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button onClick={handleSaveCredentials} size="sm">
              {_(msg`Save Credentials`)}
            </Button>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">{_(msg`Actions`)}</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={isTesting || !accessKey}
          >
            {isTesting ? _(msg`Testing...`) : _(msg`Test Connection`)}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePush}
            disabled={isPushing || !hasCredentials || !preferences.cloud_sync_enabled}
          >
            {isPushing ? _(msg`Pushing...`) : _(msg`Push Now`)}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePull}
            disabled={isPulling || !hasCredentials}
          >
            {isPulling ? _(msg`Pulling...`) : _(msg`Pull Now`)}
          </Button>
        </div>
      </div>
    </div>
  );
}
