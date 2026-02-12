import { Add01Icon, Delete02Icon, Edit02Icon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { User } from '@/lib/tauri-bindings';

interface UsersPaneProps {
  currentUser: User | null;
  users: User[];
  isError: boolean;
  onAddUser: () => void;
  onEditUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export function UsersPane({
  currentUser,
  users,
  isError,
  onAddUser,
  onEditUser,
  onDeleteUser,
}: UsersPaneProps) {
  const { _ } = useLingui();

  return (
    <section className="space-y-3 rounded-md border p-4">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={UserGroupIcon} className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{_(msg`Users`)}</h3>
      </div>

      {!currentUser?.is_admin ? (
        <div className="text-sm text-muted-foreground">
          {_(msg`User management requires an administrator account.`)}
        </div>
      ) : isError ? (
        <div className="text-sm text-destructive">{_(msg`Failed to load users`)}</div>
      ) : (
        <>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={onAddUser}>
              <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-4" />
              {_(msg`Add user`)}
            </Button>
          </div>
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{user.username}</span>
                  {user.is_admin && (
                    <Badge variant="secondary" className="text-xs">
                      {_(msg`Admin`)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onEditUser(user)}>
                    <HugeiconsIcon icon={Edit02Icon} className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={String(user.id) === String(currentUser.id)}
                    onClick={() => onDeleteUser(user)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
