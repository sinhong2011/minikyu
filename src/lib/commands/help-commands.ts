import { msg } from '@lingui/core/macro';
import i18n from '@/i18n/config';
import { notifications } from '@/lib/notifications';
import { checkLatestVersion } from '@/lib/updates';
import type { AppCommand } from './types';

export const helpCommands: AppCommand[] = [
  {
    id: 'help-check-updates',
    label: msg`Check for Updates`,
    description: msg`Check if a newer version is available`,
    group: 'help',
    keywords: ['update', 'version', 'upgrade', 'new'],
    execute: async () => {
      const _ = i18n._.bind(i18n);
      try {
        const latestVersion = await checkLatestVersion();
        if (latestVersion.status === 'available') {
          notifications.info(
            _(msg`Update Available`),
            _(msg`Version ${latestVersion.version} is available`)
          );
        } else {
          notifications.success(_(msg`Up to Date`), _(msg`You are running the latest version`));
        }
      } catch {
        notifications.error(_(msg`Update Check Failed`), _(msg`Could not check for updates`));
      }
    },
  },
  {
    id: 'help-about',
    label: msg`About Minikyu`,
    description: msg`View app version and information`,
    group: 'help',
    keywords: ['about', 'version', 'info'],
    execute: (context) => {
      context.openPreferencesPane('about');
    },
  },
  {
    id: 'help-report-issue',
    label: msg`Report an Issue`,
    description: msg`Open the issue tracker to report a bug`,
    group: 'help',
    keywords: ['report', 'bug', 'issue', 'feedback'],
    execute: () => {
      window.open('https://github.com/sinhong2011/minikyu/issues', '_blank');
    },
  },
];
