import { FolderTransferIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Feed } from '@/lib/tauri-bindings';
import { useCategories } from '@/services/miniflux/categories';
import { useUpdateFeed } from '@/services/miniflux/feeds';

interface MoveFeedDialogProps {
  feed: Feed | null;
  onOpenChange: (open: boolean) => void;
}

export function MoveFeedDialog({ feed, onOpenChange }: MoveFeedDialogProps) {
  const { _ } = useLingui();
  const { data: categories } = useCategories();
  const updateFeed = useUpdateFeed();
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>('');

  const otherCategories = React.useMemo(
    () => categories?.filter((c) => String(c.id) !== String(feed?.category?.id)) ?? [],
    [categories, feed?.category?.id]
  );

  React.useEffect(() => {
    if (feed) {
      setSelectedCategoryId('');
    }
  }, [feed]);

  const handleMove = async () => {
    if (!feed || !selectedCategoryId) return;
    try {
      await updateFeed.mutateAsync({
        id: feed.id,
        // biome-ignore lint/style/useNamingConvention: API field name
        updates: { category_id: selectedCategoryId },
      });
      onOpenChange(false);
    } catch {
      // Error handled by mutation toast
    }
  };

  return (
    <Dialog open={!!feed} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={FolderTransferIcon} className="size-5" />
            {_(msg`Move feed`)}
          </DialogTitle>
          <DialogDescription>
            {feed ? _(msg`Move "${feed.title}" to a different category.`) : ''}
          </DialogDescription>
        </DialogHeader>

        {feed?.category && (
          <div className="text-sm text-muted-foreground">
            {_(msg`Current category`)}: <span className="font-medium">{feed.category.title}</span>
          </div>
        )}

        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder={_(msg`Select a category`)} />
          </SelectTrigger>
          <SelectContent>
            {otherCategories.map((category) => (
              <SelectItem key={category.id} value={category.id.toString()}>
                {category.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {_(msg`Cancel`)}
          </Button>
          <Button onClick={handleMove} disabled={!selectedCategoryId || updateFeed.isPending}>
            {updateFeed.isPending ? _(msg`Moving...`) : _(msg`Move`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
