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
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface CategoryFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialTitle: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string) => Promise<void>;
}

export function CategoryFormDialog({
  open,
  mode,
  initialTitle,
  pending,
  onOpenChange,
  onSubmit,
}: CategoryFormDialogProps) {
  const { _ } = useLingui();

  const categorySchema = z.object({
    title: z.string().trim().min(1, _(msg`Category name is required`)),
  });

  const form = useForm({
    defaultValues: {
      title: initialTitle,
    },
    validators: {
      onBlur: categorySchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value.title.trim());
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-6 gap-6 duration-200 data-open:slide-in-from-bottom-2 data-closed:slide-out-to-bottom-2">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? _(msg`Add category`) : _(msg`Edit category`)}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? _(msg`Create a new category to organize your feeds.`)
              : _(msg`Update this category name.`)}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="title">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>{_(msg`Category name`)}</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={_(msg`e.g. Technology`)}
                  disabled={pending}
                />
                <FieldError
                  errors={
                    field.state.meta.isTouched || form.state.isSubmitted
                      ? field.state.meta.errors
                      : []
                  }
                />
              </Field>
            )}
          </form.Field>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {_(msg`Cancel`)}
            </Button>
            <Button type="submit" disabled={pending}>
              {mode === 'create' ? _(msg`Create category`) : _(msg`Save changes`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
