import {
  AddCircleIcon,
  Clock01Icon,
  Delete02Icon,
  LanguageCircleIcon,
  ShieldUserIcon,
  Tick01Icon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { confirm } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';

import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPanel,
  MenuSeparator,
  MenuTrigger,
} from '@/components/animate-ui/components/base/menu';

import { Badge } from '@/components/ui/badge';
import { resetAccountState } from '@/lib/account-reset';
import { logger } from '@/lib/logger';
import type { MinifluxConnection } from '@/lib/tauri-bindings';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { useAccounts, useActiveAccount } from '@/services/miniflux/accounts';
import { useIsConnected } from '@/services/miniflux/auth';
import { useCurrentUser } from '@/services/miniflux/users';
import { useUIStore } from '@/store/ui-store';

interface UserNavProps {
  compact?: boolean;
}

export function UserNav({ compact = false }: UserNavProps = {}) {
  const { _ } = useLingui();
  const { data: accounts = [] } = useAccounts();
  const { data: currentAccount } = useActiveAccount();
  const { data: isConnected } = useIsConnected();
  const { data: currentUser, isLoading: isUserLoading, isError: isUserError } = useCurrentUser();

  if (!currentAccount) {
    logger.debug('[UserNav] No current account found, returning null');
    return null;
  }

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const handleSwitchAccount = async (accountId: string) => {
    if (accountId === currentAccount.id) return;

    try {
      const result = await commands.switchMinifluxAccount(accountId);
      if (result.status === 'ok') {
        await resetAccountState();
      } else {
        logger.error('Failed to switch account:', { error: result.error });
      }
    } catch (error) {
      logger.error('Error switching account:', { error });
    }
  };

  const handleDeleteAccount = async (account: MinifluxConnection) => {
    const domain = getDomain(account.server_url);
    const isActive = account.id === currentAccount.id;
    const isLastAccount = accounts.length <= 1;
    const otherAccounts = accounts.filter((a) => a.id !== account.id);
    const nextAccount = otherAccounts[0];

    let message: string;
    if (isLastAccount) {
      message = _(
        msg`Delete account "${account.username}" on ${domain}? This is your only account. Deleting it will disconnect you completely.`
      );
    } else if (isActive && nextAccount) {
      message = _(
        msg`Delete account "${account.username}" on ${domain}? You are currently connected to this account. You'll be switched to "${nextAccount.username}" automatically.`
      );
    } else {
      message = _(
        msg`Delete account "${account.username}" on ${domain}? This will remove all saved credentials.`
      );
    }

    try {
      const confirmed = await confirm(message, {
        title: _(msg`Delete Account`),
        kind: 'warning',
      });

      if (!confirmed) return;

      const result = await commands.deleteMinifluxAccount(account.id);
      if (result.status === 'ok') {
        try {
          await resetAccountState();
        } catch (resetError) {
          logger.warn('Reset after account delete had non-fatal errors:', { error: resetError });
        }
        toast.success(_(msg`Account deleted successfully`));
      } else {
        toast.error(_(msg`Failed to delete account`));
      }
    } catch (error) {
      logger.error('Error deleting account:', { error });
      toast.error(_(msg`Failed to delete account`));
    }
  };

  return (
    <Menu>
      <MenuTrigger className={cn('w-full outline-none', compact && 'flex justify-center')}>
        {compact ? (
          <div
            className="flex items-center justify-center rounded-lg p-1.5 text-left transition-colors hover:bg-accent"
            title={currentAccount.username}
          >
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="size-8"
            >
              <rect width="32" height="32" rx="8" fill="#1a1a1a" />
              <circle cx="16" cy="11" r="5.5" fill="#f5ead6" />
              <circle cx="13.8" cy="10.2" r="1" fill="#2d2d2d" />
              <circle cx="18.2" cy="10.2" r="1" fill="#2d2d2d" />
              <path
                d="M14.2 13c.5.8 1.2 1.2 1.8 1.2s1.3-.4 1.8-1.2"
                stroke="#2d2d2d"
                strokeWidth="0.8"
                strokeLinecap="round"
                fill="none"
              />
              <rect x="10" y="18" width="12" height="8" rx="3" fill="#4a9eff" />
              <line x1="16" y1="19" x2="16" y2="25" stroke="#3a8aee" strokeWidth="0.8" />
              <line
                x1="12"
                y1="20.5"
                x2="14.5"
                y2="20.5"
                stroke="white"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
              <line
                x1="17.5"
                y1="20.5"
                x2="20"
                y2="20.5"
                stroke="white"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
              <line
                x1="12"
                y1="22.5"
                x2="14.5"
                y2="22.5"
                stroke="white"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
              <line
                x1="17.5"
                y1="22.5"
                x2="20"
                y2="22.5"
                stroke="white"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="size-8 shrink-0"
            >
              <rect width="32" height="32" rx="8" fill="#1a1a1a" />
              <circle cx="16" cy="11" r="5.5" fill="#f5ead6" />
              <circle cx="13.8" cy="10.2" r="1" fill="#2d2d2d" />
              <circle cx="18.2" cy="10.2" r="1" fill="#2d2d2d" />
              <path
                d="M14.2 13c.5.8 1.2 1.2 1.8 1.2s1.3-.4 1.8-1.2"
                stroke="#2d2d2d"
                strokeWidth="0.8"
                strokeLinecap="round"
                fill="none"
              />
              <rect x="10" y="18" width="12" height="8" rx="3" fill="#4a9eff" />
              <line x1="16" y1="19" x2="16" y2="25" stroke="#3a8aee" strokeWidth="0.8" />
              <line
                x1="12"
                y1="20.5"
                x2="14.5"
                y2="20.5"
                stroke="white"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
              <line
                x1="17.5"
                y1="20.5"
                x2="20"
                y2="20.5"
                stroke="white"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
              <line
                x1="12"
                y1="22.5"
                x2="14.5"
                y2="22.5"
                stroke="white"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
              <line
                x1="17.5"
                y1="22.5"
                x2="20"
                y2="22.5"
                stroke="white"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
            </svg>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-semibold">{currentAccount.username}</span>
                {currentAccount.is_admin && (
                  <Badge variant="secondary" className="px-1 py-0">
                    <HugeiconsIcon icon={ShieldUserIcon} className="size-3 shrink-0" />
                  </Badge>
                )}
              </div>
              <span className="truncate text-xs text-muted-foreground">
                {getDomain(currentAccount.server_url)}
              </span>
              {!isConnected && (
                <span className="text-[11px] text-muted-foreground">
                  {_(msg`Offline cached data`)}
                </span>
              )}
            </div>
          </div>
        )}
      </MenuTrigger>
      <MenuPanel className="w-56" side="top" align="start" sideOffset={4}>
        {!isUserLoading && !isUserError && currentUser && (
          <>
            <MenuGroup>
              <MenuGroupLabel>{_(msg`User Profile`)}</MenuGroupLabel>
              <div className="px-2 py-1.5 text-sm">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <HugeiconsIcon icon={ShieldUserIcon} className="size-3.5" />
                      {_(msg`Role`)}
                    </span>
                    <span>{currentUser.is_admin ? _(msg`Administrator`) : _(msg`User`)}</span>
                  </div>
                  {currentUser.language && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <HugeiconsIcon icon={LanguageCircleIcon} className="size-3.5" />
                        {_(msg`Language`)}
                      </span>
                      <span className="uppercase">{currentUser.language}</span>
                    </div>
                  )}
                  {currentUser.timezone && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
                        {_(msg`Timezone`)}
                      </span>
                      <span className="text-xs">{currentUser.timezone}</span>
                    </div>
                  )}
                </div>
              </div>
            </MenuGroup>
            <MenuSeparator />
          </>
        )}
        <MenuGroup>
          <MenuGroupLabel>{_(msg`Accounts`)}</MenuGroupLabel>
          {accounts.map((account) => (
            <MenuItem
              key={account.id}
              onClick={() => handleSwitchAccount(account.id)}
              className="group justify-between"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <HugeiconsIcon
                  icon={account.is_admin ? ShieldUserIcon : UserCircleIcon}
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <span className="truncate font-medium">{account.username}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {getDomain(account.server_url)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {account.id === currentAccount.id && (
                  <HugeiconsIcon icon={Tick01Icon} className="size-4 text-primary" />
                )}
                <button
                  type="button"
                  className="size-5 items-center justify-center rounded opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100 flex"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAccount(account);
                  }}
                  title={_(msg`Delete account`)}
                >
                  <HugeiconsIcon icon={Delete02Icon} className="size-3.5 text-destructive" />
                </button>
              </div>
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onClick={() => useUIStore.getState().setShowConnectionDialog(true)}>
            <HugeiconsIcon icon={AddCircleIcon} className="mr-2 size-4" />
            {_(msg`Add Account`)}
          </MenuItem>
        </MenuGroup>
      </MenuPanel>
    </Menu>
  );
}
