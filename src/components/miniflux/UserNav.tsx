import {
  AddCircleIcon,
  FileDownloadIcon,
  FileUploadIcon,
  Logout01Icon,
  Tick01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { confirm, open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
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

  const handleDeleteAccount = async () => {
    if (!currentAccount) return;

    const confirmed = await confirm(
      _(
        msg`Are you sure you want to delete this account? This will remove all credentials and data associated with "${currentAccount.username}" on ${getDomain(currentAccount.server_url)}.`
      ),
      { title: _(msg`Delete Account`), kind: 'warning' }
    );

    if (!confirmed) return;

    try {
      const result = await commands.deleteMinifluxAccount(currentAccount.id);
      if (result.status === 'ok') {
        await resetAccountState();
        toast.success(_(msg`Account deleted successfully`));
      } else {
        toast.error(_(msg`Failed to delete account`));
      }
    } catch (error) {
      logger.error('Error deleting account:', { error });
      toast.error(_(msg`Failed to delete account`));
    }
  };

  const handleExportOpml = async () => {
    try {
      const date = new Date().toISOString().split('T')[0];
      const filePath = await saveDialog({
        title: _(msg`Export OPML`),
        defaultPath: `miniflux-feeds-${date}.opml`,
        filters: [
          {
            name: 'OPML',
            extensions: ['opml'],
          },
          {
            name: 'XML',
            extensions: ['xml'],
          },
        ],
      });

      if (!filePath) {
        return;
      }

      const result = await commands.exportOpml();

      if (result.status === 'error') {
        toast.error(_(msg`Failed to export OPML`), {
          description: result.error,
        });
        return;
      }

      await writeTextFile(filePath, result.data);

      queryClient.invalidateQueries({ queryKey: ['miniflux'] });

      toast.success(_(msg`OPML exported successfully`));
    } catch (error) {
      logger.error('Failed to export OPML', { error });
      toast.error(_(msg`Failed to export OPML`), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleImportOpml = async () => {
    try {
      const filePath = await openDialog({
        title: _(msg`Import OPML`),
        multiple: false,
        filters: [
          {
            name: 'OPML',
            extensions: ['opml'],
          },
          {
            name: 'XML',
            extensions: ['xml'],
          },
          {
            name: 'All Files',
            extensions: ['*'],
          },
        ],
      });

      if (!filePath) {
        return;
      }

      const opmlContent = await readTextFile(filePath);

      const result = await commands.importOpml(opmlContent);

      if (result.status === 'error') {
        toast.error(_(msg`Failed to import OPML`), {
          description: result.error,
        });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['miniflux'] });

      toast.success(_(msg`OPML imported successfully`));
    } catch (error) {
      logger.error('Failed to import OPML', { error });
      toast.error(_(msg`Failed to import OPML`), {
        description: error instanceof Error ? error.message : String(error),
      });
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
          <MenuSeparator />
          <MenuItem onClick={() => useUIStore.getState().setShowConnectionDialog(true)}>
            <HugeiconsIcon icon={AddCircleIcon} className="mr-2 size-4" />
            {_(msg`Add Account`)}
          </MenuItem>
        </MenuGroup>
        {isConnected && (
          <>
            <MenuSeparator />
            <MenuGroup>
              <MenuGroupLabel>{_(msg`Manage`)}</MenuGroupLabel>
              <MenuItem onClick={handleExportOpml}>
                <HugeiconsIcon icon={FileDownloadIcon} className="mr-2 size-4" />
                {_(msg`Export OPML`)}
              </MenuItem>
              <MenuItem onClick={handleImportOpml}>
                <HugeiconsIcon icon={FileUploadIcon} className="mr-2 size-4" />
                {_(msg`Import OPML`)}
              </MenuItem>
            </MenuGroup>
          </>
        )}
        <MenuSeparator />
        <MenuGroup>
          <MenuItem variant="destructive" onClick={handleDeleteAccount}>
            <HugeiconsIcon icon={Logout01Icon} className="mr-2 size-4" />
            {_(msg`Delete Account`)}
          </MenuItem>
        </MenuGroup>
      </MenuPanel>
    </Menu>
  );
}
