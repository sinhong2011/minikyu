import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { DeleteDialogState } from './dialog-state';

interface DeleteEntityDialogProps {
  state: DeleteDialogState | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export function DeleteEntityDialog({
  state,
  pending,
  onOpenChange,
  onConfirm,
}: DeleteEntityDialogProps) {
  const { _ } = useLingui();
  const categoryHasFeeds = state?.type === 'category' && state.feedCount > 0;

  return (
    <AlertDialog open={state !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className="duration-200 data-open:slide-in-from-bottom-2 data-closed:slide-out-to-bottom-2">
        <AlertDialogHeader className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
          <AlertDialogTitle>
            {categoryHasFeeds
              ? _(msg`Cannot delete category`)
              : state?.type === 'category'
                ? _(msg`Delete category?`)
                : state?.type === 'feed'
                  ? _(msg`Delete feed?`)
                  : _(msg`Delete user?`)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {categoryHasFeeds
              ? _(
                  msg`"${state.title}" still has ${String(state.feedCount)} feed(s). Move or remove all feeds from this category before deleting it.`
                )
              : state?.type === 'category'
                ? _(msg`This will remove the category "${state.title}" from Miniflux.`)
                : state?.type === 'feed'
                  ? _(msg`This will permanently remove the feed "${state.title}" from Miniflux.`)
                  : _(
                      msg`This user "${state?.title ?? ''}" will be permanently removed from Miniflux.`
                    )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
          <AlertDialogCancel disabled={pending}>
            {categoryHasFeeds ? _(msg`OK`) : _(msg`Cancel`)}
          </AlertDialogCancel>
          {!categoryHasFeeds && (
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onConfirm}
              disabled={pending}
            >
              {state?.type === 'category'
                ? _(msg`Delete category`)
                : state?.type === 'feed'
                  ? _(msg`Delete feed`)
                  : _(msg`Delete user`)}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
