import { Key01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { queryClient } from '@/lib/query-client';
import { commands } from '@/lib/tauri-bindings';
import { useActiveAccount } from '@/services/miniflux/accounts';

export function ApiTokenPane() {
  const { _ } = useLingui();
  const { data: currentAccount } = useActiveAccount();
  const [tokenValue, setTokenValue] = React.useState('');
  const [isSavingToken, setIsSavingToken] = React.useState(false);

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

  return (
    <section className="space-y-3 rounded-md border p-4">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={Key01Icon} className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{_(msg`API token`)}</h3>
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
  );
}
