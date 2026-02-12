import { PencilEdit02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useForm } from '@tanstack/react-form';
import * as React from 'react';
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
import { useUpdateCategory } from '@/services/miniflux/categories';

interface EditCategoryDialogProps {
  category: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCategoryDialog({ category, open, onOpenChange }: EditCategoryDialogProps) {
  const { _ } = useLingui();
  const updateCategory = useUpdateCategory();

  const form = useForm({
    defaultValues: {
      title: category.title,
    },
    validators: {
      onChange: z.object({
        title: z.string().min(1, _(msg`Title is required`)),
      }),
    },
    onSubmit: async ({ value }) => {
      try {
        await updateCategory.mutateAsync({
          id: category.id,
          title: value.title,
        });
        onOpenChange(false);
      } catch (_error) {
        // Error handled by mutation toast
      }
    },
  });

  // Sync form with category title when dialog opens
  React.useEffect(() => {
    if (open) {
      form.reset({ title: category.title });
    }
  }, [open, category.title, form.reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-6 gap-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HugeiconsIcon icon={PencilEdit02Icon} className="size-5" />
            {_(msg`Edit Category`)}
          </DialogTitle>
          <DialogDescription>{_(msg`Update the title of your category.`)}</DialogDescription>
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
              <Label htmlFor="edit-title">{_(msg`Category Title`)}</Label>
              <form.Field name="title">
                {(field) => (
                  <div className="space-y-1">
                    <Input
                      id="edit-title"
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
            <Button type="submit" disabled={updateCategory.isPending}>
              {updateCategory.isPending ? _(msg`Saving...`) : _(msg`Save Changes`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
