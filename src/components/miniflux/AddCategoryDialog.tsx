import { Add01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
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
import { Label } from '@/components/ui/label';
import type { Category } from '@/lib/tauri-bindings';
import { useCreateCategory } from '@/services/miniflux/categories';

interface AddCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (category: Category) => void;
}

export function AddCategoryDialog({ open, onOpenChange, onCreated }: AddCategoryDialogProps) {
  const { _ } = useLingui();
  const createCategory = useCreateCategory();

  const form = useForm({
    defaultValues: {
      title: '',
    },
    validators: {
      onChange: z.object({
        title: z.string().min(1, _(msg`Title is required`)),
      }),
    },
    onSubmit: async ({ value }) => {
      try {
        const createdCategory = await createCategory.mutateAsync(value.title);
        onCreated?.(createdCategory);
        onOpenChange(false);
        form.reset();
      } catch {
        // Error handled by mutation toast
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-6 gap-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HugeiconsIcon icon={Add01Icon} className="size-5" />
            {_(msg`Add New Category`)}
          </DialogTitle>
          <DialogDescription>
            {_(msg`Create a new category to organize your feeds.`)}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{_(msg`Category Title`)}</Label>
              <form.Field name="title">
                {(field) => (
                  <div className="space-y-1">
                    <Input
                      id="title"
                      placeholder={_(msg`e.g. Technology, News`)}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.errors ? (
                      <p className="text-[0.8rem] font-medium text-destructive">
                        {field.state.meta.errors.join(', ')}
                      </p>
                    ) : null}
                  </div>
                )}
              </form.Field>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {_(msg`Cancel`)}
            </Button>
            <Button type="submit" disabled={createCategory.isPending}>
              {createCategory.isPending ? _(msg`Creating...`) : _(msg`Create Category`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
