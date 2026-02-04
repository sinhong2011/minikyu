import { Logout01Icon, Tick01Icon } from '@hugeicons/core-free-icons';
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
import { useCurrentUser } from '@/services/miniflux/users';
import { useAccountStore } from '@/store/account-store';

export function UserNav() {
  const { _ } = useLingui();
  const accounts = useAccountStore((state) => state.accounts);
  const currentAccountId = useAccountStore((state) => state.currentAccountId);
  const { data: currentUser, isLoading, isError } = useCurrentUser();

  logger.info('[UserNav] Component rendering', {
    accountsCount: accounts.length,
    currentAccountId,
    accounts: accounts.map((acc) => ({
      id: acc.id,
      username: acc.username,
      is_active: acc.is_active,
    })),
    currentUser: currentUser
      ? {
          id: currentUser.id,
          username: currentUser.username,
          is_admin: currentUser.is_admin,
        }
      : null,
    isLoading,
    isError,
  });

  const currentAccount = accounts.find((acc) => acc.id === currentAccountId);

  if (!currentAccount) {
    logger.warn('[UserNav] No current account found, returning null (component will not render)', {
      currentAccountId,
      availableAccountIds: accounts.map((acc) => acc.id),
    });
    return null;
  }

  logger.info('[UserNav] Current account found, rendering component', {
    accountId: currentAccount.id,
    username: currentAccount.username,
    server_url: currentAccount.server_url,
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
    if (accountId === currentAccountId) return;

    try {
      const result = await commands.switchMinifluxAccount(accountId);
      if (result.status === 'ok') {
        const updatedResult = await commands.getMinifluxAccounts();
        if (updatedResult.status === 'ok') {
          const { setAccounts, setCurrentAccountId } = useAccountStore.getState();
          setAccounts(updatedResult.data);
          const activeAccount = updatedResult.data.find((acc) => acc.is_active);
          if (activeAccount) {
            setCurrentAccountId(activeAccount.id);
          }
        }
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
        const updatedResult = await commands.getMinifluxAccounts();
        const { setAccounts, setCurrentAccountId } = useAccountStore.getState();
        if (updatedResult.status === 'ok') {
          setAccounts(updatedResult.data);
          const activeAccount = updatedResult.data.find((acc) => acc.is_active);
          setCurrentAccountId(activeAccount ? activeAccount.id : null);
        } else {
          setAccounts([]);
          setCurrentAccountId(null);
        }
        queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      }
    } catch (error) {
      logger.error('Error logging out:', { error });
    }
  };

  return (
    <Menu>
      <MenuTrigger className="w-full outline-none">
        <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent transition-colors text-left">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-medium">
              {getInitials(currentAccount.username)}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold">{currentAccount.username}</span>
              {!isLoading && !isError && currentUser?.is_admin && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {_(msg`Admin`)}
                </Badge>
              )}
            </div>
            <span className="truncate text-xs text-muted-foreground">
              {getDomain(currentAccount.server_url)}
            </span>
          </div>
        </div>
      </MenuTrigger>
      <MenuPanel className="w-56" side="top" align="start" sideOffset={4}>
        {!isLoading && !isError && currentUser && (
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
              {account.id === currentAccountId && (
                <HugeiconsIcon icon={Tick01Icon} className="size-4 text-primary shrink-0" />
              )}
            </MenuItem>
          ))}
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuItem variant="destructive" onClick={handleLogout}>
            <HugeiconsIcon icon={Logout01Icon} className="mr-2 size-4" />
            {_(msg`Log out`)}
          </MenuItem>
        </MenuGroup>
      </MenuPanel>
    </Menu>
  );
}
