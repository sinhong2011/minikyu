import { Add01Icon, Copy01Icon, Delete02Icon, Key01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { queryClient } from '@/lib/query-client';
import type { ApiKey } from '@/lib/tauri-bindings';
import { commands } from '@/lib/tauri-bindings';
import { useActiveAccount } from '@/services/miniflux/accounts';
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '@/services/miniflux/api-keys';

export function ApiTokenPane() {
  const { _ } = useLingui();
  const { data: currentAccount } = useActiveAccount();
  const [tokenValue, setTokenValue] = React.useState('');
  const [isSavingToken, setIsSavingToken] = React.useState(false);

  // API key management
  const { data: apiKeys = [], isError: apiKeysError } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const deleteApiKey = useDeleteApiKey();

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [newKeyDescription, setNewKeyDescription] = React.useState('');
  const [createdKey, setCreatedKey] = React.useState<ApiKey | null>(null);
  const [deleteConfirmKey, setDeleteConfirmKey] = React.useState<ApiKey | null>(null);

  const handleSaveToken = async () => {
    if (!currentAccount || !tokenValue.trim()) {
      return;
    }

    setIsSavingToken(true);

    try {
      const result = await commands.minifluxConnect({
        // biome-ignore lint/style/useNamingConvention: API field names
        server_url: currentAccount.server_url,
        // biome-ignore lint/style/useNamingConvention: API field names
        auth_token: tokenValue.trim(),
      });

      if (result.status === 'error') {
        toast.error(_(msg`Failed to update API token`), {
          description: result.error,
        });
        return;
      }

      setTokenValue('');
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      toast.success(_(msg`API token updated`));
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newKeyDescription.trim()) return;

    try {
      const key = await createApiKey.mutateAsync(newKeyDescription.trim());
      setNewKeyDescription('');
      setCreateDialogOpen(false);
      setCreatedKey(key);
    } catch {
      // Error handled by mutation hook
    }
  };

  const handleDeleteApiKey = async () => {
    if (!deleteConfirmKey) return;

    try {
      await deleteApiKey.mutateAsync(deleteConfirmKey.id);
      setDeleteConfirmKey(null);
    } catch {
      // Error handled by mutation hook
    }
  };

  const handleCopyToken = async (token: string) => {
    await writeText(token);
    toast.success(_(msg`Token copied to clipboard`));
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return _(msg`Never`);
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <>
      {/* API Keys Section */}
      <section className="space-y-3 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Key01Icon} className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{_(msg`API keys`)}</h3>
          </div>
          {!apiKeysError && (
            <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(true)}>
              <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-4" />
              {_(msg`Create API key`)}
            </Button>
          )}
        </div>

        {apiKeysError ? (
          <div className="text-sm text-destructive">{_(msg`Failed to load API keys`)}</div>
        ) : apiKeys.length === 0 ? (
          <div className="text-sm text-muted-foreground">{_(msg`No API keys created yet.`)}</div>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{key.description}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {_(msg`Created`)}: {formatDate(key.created_at)}
                    </span>
                    <span>
                      {_(msg`Last used`)}: {formatDate(key.last_used_at)}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmKey(key)}>
                  <HugeiconsIcon icon={Delete02Icon} className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Update Connection Token Section */}
      <section className="space-y-3 rounded-md border p-4">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Key01Icon} className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{_(msg`Connection token`)}</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          {currentAccount
            ? `${_(msg`Server`)}: ${currentAccount.server_url}`
            : _(msg`No active account`)}
        </div>
        <div className="flex gap-2">
          <Input
            type="password"
            value={tokenValue}
            onChange={(event) => setTokenValue(event.target.value)}
            placeholder={_(msg`Paste new API token`)}
            disabled={isSavingToken || !currentAccount}
          />
          <Button
            onClick={handleSaveToken}
            disabled={isSavingToken || !currentAccount || !tokenValue.trim()}
          >
            {_(msg`Update token`)}
          </Button>
        </div>
      </section>

      {/* Create API Key Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{_(msg`Create API key`)}</DialogTitle>
            <DialogDescription>
              {_(msg`Enter a description for the new API key.`)}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newKeyDescription}
            onChange={(e) => setNewKeyDescription(e.target.value)}
            placeholder={_(msg`API key description`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateApiKey();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {_(msg`Cancel`)}
            </Button>
            <Button
              onClick={handleCreateApiKey}
              disabled={createApiKey.isPending || !newKeyDescription.trim()}
            >
              {_(msg`Create`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created Key Token Display Dialog */}
      <Dialog
        open={!!createdKey}
        onOpenChange={(open) => {
          if (!open) setCreatedKey(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{_(msg`API key created`)}</DialogTitle>
            <DialogDescription>
              {_(msg`Copy this token now. It will not be shown again.`)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{createdKey?.description}</Badge>
            </div>
            {createdKey?.token && (
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono break-all">
                  {createdKey.token}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => createdKey.token && handleCopyToken(createdKey.token)}
                >
                  <HugeiconsIcon icon={Copy01Icon} className="size-4" />
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>{_(msg`Done`)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete API Key Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmKey}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmKey(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{_(msg`Delete API key`)}</DialogTitle>
            <DialogDescription>
              {_(
                msg`Are you sure you want to delete the API key "${deleteConfirmKey?.description ?? ''}"? This action cannot be undone.`
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmKey(null)}>
              {_(msg`Cancel`)}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteApiKey}
              disabled={deleteApiKey.isPending}
            >
              {_(msg`Delete`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
