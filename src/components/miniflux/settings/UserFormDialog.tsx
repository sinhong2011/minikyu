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

interface UserFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialUsername: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { username: string; password: string; isAdmin: boolean }) => Promise<void>;
}

export function UserFormDialog({
  open,
  mode,
  initialUsername,
  pending,
  onOpenChange,
  onSubmit,
}: UserFormDialogProps) {
  const { _ } = useLingui();

  const userSchema = z.object({
    username: z.string().trim().min(1, _(msg`Username is required`)),
    password: mode === 'create' ? z.string().min(1, _(msg`Password is required`)) : z.string(),
    isAdmin: z.enum(['yes', 'no']),
  });

  const form = useForm({
    defaultValues: {
      username: initialUsername,
      password: '',
      isAdmin: 'no' as 'yes' | 'no',
    },
    validators: {
      onBlur: userSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        username: value.username.trim(),
        password: value.password,
        isAdmin: value.isAdmin === 'yes',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] p-6 gap-6 duration-200 data-open:slide-in-from-bottom-2 data-closed:slide-out-to-bottom-2">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? _(msg`Add user`) : _(msg`Edit user`)}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? _(msg`Create a Miniflux user account.`)
              : _(msg`Update username or password.`)}
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
          <form.Field name="username">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>{_(msg`Username`)}</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
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

          <form.Field name="password">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {mode === 'create' ? _(msg`Password`) : _(msg`New password (optional)`)}
                </FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
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

          {mode === 'create' && (
            <form.Field name="isAdmin">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>{_(msg`Role`)}</FieldLabel>
                  <select
                    id={field.name}
                    className="bg-background border-input h-9 w-full rounded-md border px-3 text-sm"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value as 'yes' | 'no')}
                    disabled={pending}
                  >
                    <option value="no">{_(msg`User`)}</option>
                    <option value="yes">{_(msg`Administrator`)}</option>
                  </select>
                </Field>
              )}
            </form.Field>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {_(msg`Cancel`)}
            </Button>
            <Button type="submit" disabled={pending}>
              {mode === 'create' ? _(msg`Create user`) : _(msg`Save changes`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
