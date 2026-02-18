import {
  Alert01Icon,
  CheckmarkCircle01Icon,
  InformationCircleIcon,
  Loading03Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useState } from 'react';
import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { checkLatestVersion } from '@/lib/updates';
import { cn } from '@/lib/utils';
import { useMinifluxVersion } from '@/services/miniflux';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';

type UpdateCheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'up-to-date' }
  | { status: 'available'; version: string }
  | { status: 'error' };

export function AboutPane() {
  const { _ } = useLingui();
  const {
    data: minifluxVersion,
    isLoading: versionLoading,
    error: versionError,
  } = useMinifluxVersion();
  const [updateCheckState, setUpdateCheckState] = useState<UpdateCheckState>({ status: 'idle' });

  const handleCheckForUpdates = async () => {
    setUpdateCheckState({ status: 'checking' });

    try {
      const latestVersion = await checkLatestVersion();
      if (latestVersion.status === 'available') {
        setUpdateCheckState({
          status: 'available',
          version: latestVersion.version,
        });
      } else {
        setUpdateCheckState({ status: 'up-to-date' });
      }
    } catch (error) {
      logger.error('Failed to check latest version from About pane', { error });
      setUpdateCheckState({ status: 'error' });
    }
  };

  const updateStatusText = (() => {
    switch (updateCheckState.status) {
      case 'checking':
        return _(msg`Checking for updates...`);
      case 'up-to-date':
        return _(msg`You are running the latest version.`);
      case 'available':
        return _(msg`Version ${updateCheckState.version} is available.`);
      case 'error':
        return _(msg`Could not check for updates. Please try again.`);
      default:
        return _(msg`Check whether a newer release is available.`);
    }
  })();

  const updateStatusIcon = (() => {
    switch (updateCheckState.status) {
      case 'checking':
        return <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin text-primary" />;
      case 'up-to-date':
        return <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4 text-green-600" />;
      case 'available':
        return <HugeiconsIcon icon={InformationCircleIcon} className="size-4 text-blue-600" />;
      case 'error':
        return <HugeiconsIcon icon={Alert01Icon} className="size-4 text-destructive" />;
      default:
        return (
          <HugeiconsIcon icon={InformationCircleIcon} className="size-4 text-muted-foreground" />
        );
    }
  })();

  const isChecking = updateCheckState.status === 'checking';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-3">
          <AppLogo showWordmark={false} markClassName="size-12" />
          <div>
            <h3 className="text-lg font-semibold">{_(msg`Minikyu`)}</h3>
            <p className="text-sm text-muted-foreground">{_(msg`RSS Reader`)}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {_(
            msg`A calm, focused space for your Miniflux reading. Catch up faster, stay organized, and enjoy every feed.`
          )}
        </p>
      </div>

      <SettingsSection title={_(msg`Version`)}>
        <SettingsField
          label={_(msg`Current version`)}
          description={_(msg`Installed version of Minikyu.`)}
        >
          <p className="text-sm font-medium">{__APP_VERSION__}</p>
        </SettingsField>

        <SettingsField label={_(msg`Latest version`)} description={updateStatusText}>
          <div className="flex items-center gap-2">
            {updateStatusIcon}
            <Button variant="outline" onClick={handleCheckForUpdates} disabled={isChecking}>
              <HugeiconsIcon
                icon={isChecking ? Loading03Icon : RefreshIcon}
                className={cn('size-4', isChecking && 'animate-spin')}
              />
              {isChecking ? _(msg`Checking...`) : _(msg`Check latest version`)}
            </Button>
          </div>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={_(msg`Miniflux Server`)}>
        {versionLoading ? (
          <SettingsField
            label={_(msg`Server version`)}
            description={_(msg`Loading version information...`)}
          >
            <HugeiconsIcon
              icon={Loading03Icon}
              className="size-4 animate-spin text-muted-foreground"
            />
          </SettingsField>
        ) : versionError ? (
          <SettingsField
            label={_(msg`Server version`)}
            description={_(msg`Could not load server version information.`)}
          >
            <HugeiconsIcon icon={Alert01Icon} className="size-4 text-destructive" />
          </SettingsField>
        ) : !minifluxVersion ? (
          <SettingsField
            label={_(msg`Server version`)}
            description={_(msg`Connect to Miniflux to see server version.`)}
          >
            <HugeiconsIcon icon={InformationCircleIcon} className="size-4 text-muted-foreground" />
          </SettingsField>
        ) : (
          <>
            <SettingsField label={_(msg`Version`)} description={_(msg`Miniflux server version.`)}>
              <p className="text-sm font-medium">{minifluxVersion.version}</p>
            </SettingsField>

            {minifluxVersion.commit && (
              <SettingsField label={_(msg`Commit`)} description={_(msg`Git commit hash.`)}>
                <p className="text-sm font-medium font-mono">
                  {minifluxVersion.commit.slice(0, 7)}
                </p>
              </SettingsField>
            )}

            {minifluxVersion.build_date && (
              <SettingsField
                label={_(msg`Build date`)}
                description={_(msg`Server build timestamp.`)}
              >
                <p className="text-sm font-medium">{minifluxVersion.build_date}</p>
              </SettingsField>
            )}

            {(minifluxVersion.go_version || minifluxVersion.os || minifluxVersion.arch) && (
              <SettingsField
                label={_(msg`Runtime`)}
                description={_(msg`Server runtime environment.`)}
              >
                <p className="text-sm text-muted-foreground">
                  {[minifluxVersion.go_version, minifluxVersion.os, minifluxVersion.arch]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </SettingsField>
            )}
          </>
        )}
      </SettingsSection>
    </div>
  );
}
