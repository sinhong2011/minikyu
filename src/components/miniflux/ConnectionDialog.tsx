import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useForm } from '@tanstack/react-form';
import { useMemo } from 'react';
import { z } from 'zod';
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsPanels,
  TabsTab,
} from '@/components/animate-ui/components/base/tabs';
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from '@/components/ui/autocomplete';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Spinner } from '@/components/ui/spinner';
import { logger } from '@/lib/logger';
import { queryClient } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { useConnect } from '@/services/miniflux';
import { useAccounts } from '@/services/miniflux/accounts';

interface ConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoReconnectError?: string | null;
}

export function ConnectionDialog({
  open,
  onOpenChange,
  autoReconnectError,
}: ConnectionDialogProps) {
  const { _ } = useLingui();
  const connect = useConnect();
  const { data: accounts = [] } = useAccounts();

  const serverUrls = useMemo(() => {
    const uniqueUrls = new Set(accounts.map((acc) => acc.server_url));
    return Array.from(uniqueUrls);
  }, [accounts]);

  // Zod schema for form validation with translated error messages
  const connectionSchema = z
    .object({
      serverUrl: z.string().min(1, _(msg`Server URL is required`)),
      authToken: z.string(),
      username: z.string(),
      password: z.string(),
      authMethod: z.enum(['token', 'password']),
    })
    .superRefine((data, ctx) => {
      if (data.authMethod === 'token') {
        if (data.authToken.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: _(msg`API Token is required`),
            path: ['authToken'],
          });
        }
      } else {
        if (data.username.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: _(msg`Username is required`),
            path: ['username'],
          });
        }
        if (data.password.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: _(msg`Password is required`),
            path: ['password'],
          });
        }
      }
    });

  const form = useForm({
    defaultValues: {
      serverUrl: '',
      authToken: '',
      username: '',
      password: '',
      authMethod: 'token' as 'token' | 'password',
    },
    validators: {
      onBlur: connectionSchema,
    },
    onSubmit: async ({ value }) => {
      logger.debug('Submitting connection form');

      // Auto-complete https:// prefix if not present
      const normalizedServerUrl = value.serverUrl.startsWith('http')
        ? value.serverUrl
        : `https://${value.serverUrl}`;

      const config =
        value.authMethod === 'token'
          ? {
              // biome-ignore lint/style/useNamingConvention: Required by Rust backend
              server_url: normalizedServerUrl,
              // biome-ignore lint/style/useNamingConvention: Required by Rust backend
              auth_token: value.authToken,
              username: null,
              password: null,
            }
          : {
              // biome-ignore lint/style/useNamingConvention: Required by Rust backend
              server_url: normalizedServerUrl,
              // biome-ignore lint/style/useNamingConvention: Required by Rust backend
              auth_token: null,
              username: value.username,
              password: value.password,
            };

      try {
        await connect.mutateAsync(config);

        queryClient.invalidateQueries({ queryKey: ['miniflux'] });

        onOpenChange(false);
        form.reset();
      } catch {
        // Error is handled by the mutation
      }
    },
  });

  const handleFillFromEnv = () => {
    const envAuthType = import.meta.env.VITE_AUTH_TYPE;
    const envServerUrl = import.meta.env.VITE_SERVER_URL;
    const envApiKey = import.meta.env.VITE_API_KEY;

    if (envServerUrl) {
      // Auto-complete https:// prefix if not present
      const url = envServerUrl.startsWith('http') ? envServerUrl : `https://${envServerUrl}`;
      form.setFieldValue('serverUrl', url);
    }
    if (envAuthType === 'token' || envAuthType === 'password') {
      form.setFieldValue('authMethod', envAuthType);
    }
    if (envAuthType === 'token' && envApiKey) {
      form.setFieldValue('authToken', envApiKey);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125 p-8">
        <DialogHeader>
          <DialogTitle>{_(msg`Connect to Miniflux`)}</DialogTitle>
          <DialogDescription>
            {_(msg`Enter your Miniflux server details to connect and sync your feeds.`)}
          </DialogDescription>
        </DialogHeader>

        {autoReconnectError && (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-2 rounded-md">
            {_(msg`Could not connect to saved account. Please update your credentials.`)}
          </div>
        )}

        <form
          id="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="space-y-4 py-4">
            <form.Field name="serverUrl">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>{_(msg`Server URL`)}</FieldLabel>
                  <Autocomplete
                    items={serverUrls}
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  >
                    <div className="flex items-center gap-2">
                      <AutocompleteInput
                        placeholder={_(msg`Select or enter server URL`)}
                        className={cn(
                          'flex-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:ring-2 file:ring-ring file:ring-offset-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                          field.state.meta.errors.length > 0 ? 'border-destructive' : ''
                        )}
                      />
                    </div>
                    <AutocompleteContent className="w-full p-0" align="start">
                      <AutocompleteList>
                        <AutocompleteEmpty>{_(msg`No server URL found.`)}</AutocompleteEmpty>
                        {serverUrls.map((url) => (
                          <AutocompleteItem key={url} value={url}>
                            {url}
                          </AutocompleteItem>
                        ))}
                      </AutocompleteList>
                    </AutocompleteContent>
                  </Autocomplete>
                  <FieldError
                    errors={
                      field.state.meta.isTouched || form.state.isSubmitted
                        ? field.state.meta.errors
                        : []
                    }
                  />
                  <FieldDescription>
                    {_(msg`The URL of your Miniflux server (e.g., miniflux.example.com)`)}
                  </FieldDescription>
                </Field>
              )}
            </form.Field>

            <form.Field name="authMethod">
              {(field) => (
                <Tabs
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as 'token' | 'password')}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTab value="token">{_(msg`API Token`)}</TabsTab>
                    <TabsTab value="password">{_(msg`Username/Password`)}</TabsTab>
                  </TabsList>

                  <TabsPanels>
                    <TabsPanel value="token" className="space-y-4 pt-4">
                      <form.Field name="authToken">
                        {(tokenField) => (
                          <Field>
                            <FieldLabel htmlFor={tokenField.name}>{_(msg`API Token`)}</FieldLabel>
                            <PasswordInput
                              id={tokenField.name}
                              name={tokenField.name}
                              value={tokenField.state.value}
                              onBlur={tokenField.handleBlur}
                              onChange={(e) => tokenField.handleChange(e.target.value)}
                              placeholder={_(msg`Enter your API token`)}
                              required={field.state.value === 'token'}
                              className={
                                tokenField.state.meta.errors.length > 0 ? 'border-destructive' : ''
                              }
                            />
                            <FieldError
                              errors={
                                tokenField.state.meta.isTouched || form.state.isSubmitted
                                  ? tokenField.state.meta.errors
                                  : []
                              }
                            />
                            <FieldDescription>
                              {_(msg`You can find your API token in Miniflux Settings → API Keys`)}
                            </FieldDescription>
                          </Field>
                        )}
                      </form.Field>
                    </TabsPanel>

                    <TabsPanel value="password" className="space-y-4 pt-4">
                      <form.Field name="username">
                        {(usernameField) => (
                          <Field>
                            <FieldLabel htmlFor={usernameField.name}>{_(msg`Username`)}</FieldLabel>
                            <Input
                              id={usernameField.name}
                              name={usernameField.name}
                              value={usernameField.state.value}
                              onBlur={usernameField.handleBlur}
                              onChange={(e) => usernameField.handleChange(e.target.value)}
                              placeholder={_(msg`Enter your username`)}
                              required={field.state.value === 'password'}
                              className={
                                usernameField.state.meta.errors.length > 0
                                  ? 'border-destructive'
                                  : ''
                              }
                            />
                            <FieldError
                              errors={
                                usernameField.state.meta.isTouched || form.state.isSubmitted
                                  ? usernameField.state.meta.errors
                                  : []
                              }
                            />
                          </Field>
                        )}
                      </form.Field>
                      <form.Field name="password">
                        {(passwordField) => (
                          <Field>
                            <FieldLabel htmlFor={passwordField.name}>{_(msg`Password`)}</FieldLabel>
                            <PasswordInput
                              id={passwordField.name}
                              name={passwordField.name}
                              value={passwordField.state.value}
                              onBlur={passwordField.handleBlur}
                              onChange={(e) => passwordField.handleChange(e.target.value)}
                              placeholder={_(msg`Enter your password`)}
                              required={field.state.value === 'password'}
                              className={
                                passwordField.state.meta.errors.length > 0
                                  ? 'border-destructive'
                                  : ''
                              }
                            />
                            <FieldError
                              errors={
                                passwordField.state.meta.isTouched || form.state.isSubmitted
                                  ? passwordField.state.meta.errors
                                  : []
                              }
                            />
                          </Field>
                        )}
                      </form.Field>
                    </TabsPanel>
                  </TabsPanels>
                </Tabs>
              )}
            </form.Field>
          </div>

          <DialogFooter className="bg-background border-0">
            {import.meta.env.DEV && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFillFromEnv}
                className="mr-auto"
              >
                {_(msg`Fill from .env`)}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={connect.isPending}
            >
              {_(msg`Cancel`)}
            </Button>
            <Button type="submit" disabled={connect.isPending}>
              {connect.isPending ? (
                <>
                  <Spinner className="mr-2" />
                  {_(msg`Connecting...`)}
                </>
              ) : (
                _(msg`Connect`)
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
