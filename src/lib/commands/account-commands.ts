import { AddCircleIcon, Delete02Icon } from '@hugeicons/core-free-icons';
import { msg } from '@lingui/core/macro';
import { i18n } from '@/i18n';
import { resetAccountState } from '@/lib/account-reset';
import { commands } from '@/lib/tauri-bindings';
import { useUIStore } from '@/store/ui-store';
import type { AppCommand } from './types';

export const accountCommands: AppCommand[] = [
  {
    id: 'add-account',
    label: msg`Add Account`,
    description: msg`Connect to a Miniflux server`,
    icon: AddCircleIcon,
    group: 'account',
    keywords: ['connect', 'login', 'server', 'miniflux'],
    execute: () => {
      useUIStore.getState().setShowConnectionDialog(true);
    },
  },
  {
    id: 'delete-account',
    label: msg`Delete Account`,
    description: msg`Remove current account and all related data`,
    icon: Delete02Icon,
    group: 'account',
    keywords: ['delete', 'remove', 'disconnect', 'logout', 'sign out'],
    execute: async () => {
      const { confirm } = await import('@tauri-apps/plugin-dialog');
      const _ = i18n._.bind(i18n);

      const accountResult = await commands.getActiveMinifluxAccount();
      if (accountResult.status !== 'ok' || !accountResult.data) return;

      const account = accountResult.data;
      const confirmed = await confirm(
        _(
          msg`Are you sure you want to delete this account? This will remove all credentials and data associated with this account.`
        ),
        { title: _(msg`Delete Account`), kind: 'warning' }
      );

      if (!confirmed) return;

      const result = await commands.deleteMinifluxAccount(account.id);
      if (result.status === 'ok') {
        await resetAccountState();
      }
    },
    isAvailable: (ctx) => ctx.isConnected(),
  },
];
