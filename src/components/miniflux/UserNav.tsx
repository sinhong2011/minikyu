import { Logout01Icon, PreferenceVerticalIcon, Tick01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPanel,
  MenuSeparator,
  MenuTrigger,
} from '@/components/animate-ui/components/base/menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';
import { queryClient } from '@/lib/query-client';
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
  const setPreferencesOpen = useUIStore((state) => state.setPreferencesOpen);
  const setPreferencesActivePane = useUIStore((state) => state.setPreferencesActivePane);
  const { data: accounts = [] } = useAccounts();
  const { data: currentAccount } = useActiveAccount();
  const { data: isConnected } = useIsConnected();
  const { data: currentUser, isLoading: isUserLoading, isError: isUserError } = useCurrentUser();

  logger.info('[UserNav] Component rendering', {
    accountsCount: accounts.length,
    currentAccountId: currentAccount?.id,
    currentUser: currentUser
      ? {
          id: currentUser.id,
          username: currentUser.username,
          isAdmin: currentUser.is_admin,
        }
      : null,
    isUserLoading,
    isUserError,
    isConnected,
  });

  if (!currentAccount) {
    logger.warn('[UserNav] No current account found, returning null (component will not render)', {
      availableAccountIds: accounts.map((acc) => acc.id),
    });
    return null;
  }

  logger.info('[UserNav] Current account found, rendering component', {
    accountId: currentAccount.id,
    username: currentAccount.username,
    serverUrl: currentAccount.server_url,
  });

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

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
        queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      } else {
        logger.error('Failed to switch account:', { error: result.error });
      }
    } catch (error) {
      logger.error('Error switching account:', { error });
    }
  };

  const handleLogout = async () => {
    try {
      const result = await commands.minifluxDisconnect();
      if (result.status === 'ok') {
        queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      }
    } catch (error) {
      logger.error('Error logging out:', { error });
    }
  };

  const handleOpenSettings = () => {
    setPreferencesActivePane('categories');
    setPreferencesOpen(true);
  };

  return (
    <>
      <Menu>
        <MenuTrigger className={cn('w-full outline-none', compact && 'flex justify-center')}>
          {compact ? (
            <div
              className="flex items-center justify-center rounded-lg p-1.5 text-left transition-colors hover:bg-accent"
              title={currentAccount.username}
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-medium">
                  {getInitials(currentAccount.username)}
                </AvatarFallback>
              </Avatar>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-medium">
                  {getInitials(currentAccount.username)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{currentAccount.username}</span>
                  {!isUserLoading && !isUserError && currentUser?.is_admin && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {_(msg`Admin`)}
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
                      <span className="text-muted-foreground">{_(msg`Role`)}</span>
                      <span>{currentUser.is_admin ? _(msg`Administrator`) : _(msg`User`)}</span>
                    </div>
                    {currentUser.language && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{_(msg`Language`)}</span>
                        <span className="uppercase">{currentUser.language}</span>
                      </div>
                    )}
                    {currentUser.timezone && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{_(msg`Timezone`)}</span>
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
                className="justify-between"
              >
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <span className="truncate font-medium">{account.username}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {getDomain(account.server_url)}
                  </span>
                </div>
                {account.id === currentAccount.id && (
                  <HugeiconsIcon icon={Tick01Icon} className="size-4 text-primary shrink-0" />
                )}
              </MenuItem>
            ))}
          </MenuGroup>
          {isConnected && (
            <>
              <MenuSeparator />
              <MenuGroup>
                <MenuItem onClick={handleOpenSettings}>
                  <HugeiconsIcon icon={PreferenceVerticalIcon} className="mr-2 size-4" />
                  {_(msg`Miniflux settings`)}
                </MenuItem>
              </MenuGroup>
            </>
          )}
          <MenuSeparator />
          <MenuGroup>
            <MenuItem variant="destructive" onClick={handleLogout}>
              <HugeiconsIcon icon={Logout01Icon} className="mr-2 size-4" />
              {_(msg`Log out`)}
            </MenuItem>
          </MenuGroup>
        </MenuPanel>
      </Menu>
    </>
  );
}
