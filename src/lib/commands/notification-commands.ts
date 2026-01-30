import { msg } from '@lingui/core/macro';
import i18n from '@/i18n/config';
import { notifications } from '@/lib/notifications';
import type { AppCommand } from './types';

export const notificationCommands: AppCommand[] = [
  {
    id: 'notification.test-toast',
    label: msg`Test Toast Notification`,
    description: msg`Show a test toast notification`,
    group: 'debug',
    keywords: ['test', 'toast', 'notification', 'debug'],
    async execute() {
      await notifications.success(
        i18n._(msg`Test Toast`),
        i18n._(msg`This is a test notification`)
      );
    },
  },
];
