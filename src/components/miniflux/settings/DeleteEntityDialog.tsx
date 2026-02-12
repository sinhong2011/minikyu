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

  return (
    <AlertDialog open={state !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className="duration-200 data-open:slide-in-from-bottom-2 data-closed:slide-out-to-bottom-2">
        <AlertDialogHeader className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
          <AlertDialogTitle>
            {state?.type === 'category'
              ? _(msg`Delete category?`)
              : state?.type === 'feed'
                ? _(msg`Delete feed?`)
                : _(msg`Delete user?`)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {state?.type === 'category'
              ? _(msg`This will remove the category from Miniflux.`)
              : state?.type === 'feed'
                ? _(msg`This will permanently remove the feed from Miniflux.`)
                : _(msg`This user will be permanently removed from Miniflux.`)}
            {state ? ` ${state.title}` : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
          <AlertDialogCancel disabled={pending}>{_(msg`Cancel`)}</AlertDialogCancel>
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
