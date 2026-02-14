import { ArrowDown01Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useForm } from '@tanstack/react-form';
import * as React from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { Category, Subscription } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { useSearchSources } from '@/services/miniflux';

interface FeedFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialFeedUrl: string;
  initialTitle: string;
  initialCategoryId: string | null;
  initialCategoryTitle?: string;
  initialAdvanced?: FeedAdvancedValues;
  showAdvancedByDefault?: boolean;
  categories: Category[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: FeedFormSubmitInput) => Promise<void>;
}

interface CategoryOption {
  value: string;
  label: string;
}

export interface FeedAdvancedValues {
  userAgent: string;
  username: string;
  password: string;
  scraperRules: string;
  rewriteRules: string;
  blocklistRules: string;
  keeplistRules: string;
  crawler: boolean;
  disabled: boolean;
  ignoreHttpCache: boolean;
  fetchViaProxy: boolean;
}

export interface FeedFormSubmitInput {
  feedUrl: string;
  title: string;
  categoryId: string | null;
  advanced?: FeedAdvancedValues;
}

const EMPTY_ADVANCED_VALUES: FeedAdvancedValues = {
  userAgent: '',
  username: '',
  password: '',
  scraperRules: '',
  rewriteRules: '',
  blocklistRules: '',
  keeplistRules: '',
  crawler: false,
  disabled: false,
  ignoreHttpCache: false,
  fetchViaProxy: false,
};

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isValidUrl(value: string): boolean {
  try {
    const normalized = normalizeUrl(value);
    if (!normalized) {
      return false;
    }

    const parsed = new URL(normalized);
    return parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function hasAdvancedDefaults(values: FeedAdvancedValues): boolean {
  return Boolean(
    values.userAgent.trim() ||
      values.username.trim() ||
      values.password.trim() ||
      values.scraperRules.trim() ||
      values.rewriteRules.trim() ||
      values.blocklistRules.trim() ||
      values.keeplistRules.trim() ||
      values.crawler ||
      values.disabled ||
      values.ignoreHttpCache ||
      values.fetchViaProxy
  );
}

export function FeedFormDialog({
  open,
  mode,
  initialFeedUrl,
  initialTitle,
  initialCategoryId,
  initialCategoryTitle,
  initialAdvanced,
  showAdvancedByDefault,
  categories,
  pending,
  onOpenChange,
  onSubmit,
}: FeedFormDialogProps) {
  const { _ } = useLingui();
  const searchSources = useSearchSources();
  const [discoveredSources, setDiscoveredSources] = React.useState<Subscription[]>([]);
  const [categorySearchQuery, setCategorySearchQuery] = React.useState(
    mode === 'edit' ? (initialCategoryTitle ?? _(msg`No category`)) : ''
  );

  const advancedDefaults = initialAdvanced ?? EMPTY_ADVANCED_VALUES;
  const [showAdvanced, setShowAdvanced] = React.useState(
    mode === 'edit' && (showAdvancedByDefault ?? hasAdvancedDefaults(advancedDefaults))
  );

  const categoryOptions = React.useMemo<CategoryOption[]>(() => {
    const baseOptions: CategoryOption[] = [
      { value: 'none', label: _(msg`No category`) },
      ...categories.map((category) => ({
        value: String(category.id),
        label: category.title,
      })),
    ];

    if (
      mode === 'edit' &&
      initialCategoryId &&
      initialCategoryTitle &&
      !baseOptions.some((option) => option.value === initialCategoryId)
    ) {
      baseOptions.splice(1, 0, {
        value: initialCategoryId,
        label: initialCategoryTitle,
      });
    }

    return baseOptions;
  }, [categories, initialCategoryId, initialCategoryTitle, mode]);

  const areCategoryOptionsEqual = React.useCallback(
    (a: CategoryOption | null, b: CategoryOption | null) => {
      if (a === null || b === null) {
        return a === b;
      }
      return a.value === b.value;
    },
    []
  );

  const filteredCategoryOptions = React.useMemo<CategoryOption[]>(() => {
    const query = categorySearchQuery.trim().toLowerCase();
    if (!query) {
      return categoryOptions;
    }
    return categoryOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [categoryOptions, categorySearchQuery]);

  const feedSchema = z.object({
    sourceUrl: z.string(),
    feedUrl: z
      .string()
      .trim()
      .min(1, _(msg`Feed URL is required`))
      .refine((value) => isValidUrl(value), _(msg`Feed URL must be a valid URL`)),
    title: z.string(),
    categoryId: z.string(),
    userAgent: z.string(),
    username: z.string(),
    password: z.string(),
    scraperRules: z.string(),
    rewriteRules: z.string(),
    blocklistRules: z.string(),
    keeplistRules: z.string(),
    crawler: z.boolean(),
    disabled: z.boolean(),
    ignoreHttpCache: z.boolean(),
    fetchViaProxy: z.boolean(),
  });

  const form = useForm({
    defaultValues: {
      sourceUrl: '',
      feedUrl: initialFeedUrl,
      title: initialTitle,
      categoryId: initialCategoryId ?? 'none',
      userAgent: advancedDefaults.userAgent,
      username: advancedDefaults.username,
      password: advancedDefaults.password,
      scraperRules: advancedDefaults.scraperRules,
      rewriteRules: advancedDefaults.rewriteRules,
      blocklistRules: advancedDefaults.blocklistRules,
      keeplistRules: advancedDefaults.keeplistRules,
      crawler: advancedDefaults.crawler,
      disabled: advancedDefaults.disabled,
      ignoreHttpCache: advancedDefaults.ignoreHttpCache,
      fetchViaProxy: advancedDefaults.fetchViaProxy,
    },
    validators: {
      onBlur: feedSchema,
    },
    onSubmit: async ({ value }) => {
      const normalizedCategoryId = value.categoryId === 'none' ? null : value.categoryId;

      await onSubmit({
        feedUrl: normalizeUrl(value.feedUrl),
        title: value.title.trim(),
        categoryId: normalizedCategoryId,
        advanced:
          mode === 'edit'
            ? {
                userAgent: value.userAgent,
                username: value.username,
                password: value.password,
                scraperRules: value.scraperRules,
                rewriteRules: value.rewriteRules,
                blocklistRules: value.blocklistRules,
                keeplistRules: value.keeplistRules,
                crawler: value.crawler,
                disabled: value.disabled,
                ignoreHttpCache: value.ignoreHttpCache,
                fetchViaProxy: value.fetchViaProxy,
              }
            : undefined,
      });
    },
  });

  const handleSearchSources = async () => {
    if (mode !== 'create') {
      return;
    }

    const sourceUrl = form.getFieldValue('sourceUrl')?.trim();
    if (!sourceUrl) {
      return;
    }

    try {
      const results = await searchSources.mutateAsync(normalizeUrl(sourceUrl));
      setDiscoveredSources(results);

      if (results.length === 1 && results[0]) {
        form.setFieldValue('feedUrl', results[0].url);
      }
    } catch {
      setDiscoveredSources([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'sm:max-w-xl duration-200 data-open:slide-in-from-bottom-2 data-closed:slide-out-to-bottom-2',
          mode === 'edit' && 'sm:max-w-[640px] max-h-[85vh] overflow-hidden p-6 gap-6 flex flex-col'
        )}
      >
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? _(msg`Add feed`) : _(msg`Edit feed`)}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? _(msg`Search a source URL or paste a direct feed URL.`)
              : _(msg`Update feed details and category.`)}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
          className={cn(
            'space-y-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300',
            mode === 'edit' && 'space-y-6 overflow-y-auto min-h-0 pr-1'
          )}
        >
          {mode === 'create' && (
            <>
              <form.Field name="sourceUrl">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>{_(msg`Search source URL`)}</FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder={_(msg`e.g. blog.example.com`)}
                        disabled={pending || searchSources.isPending}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSearchSources}
                        disabled={pending || searchSources.isPending || !field.state.value.trim()}
                      >
                        <HugeiconsIcon icon={Search01Icon} className="mr-1.5 size-4" />
                        {_(msg`Search`)}
                      </Button>
                    </div>
                  </Field>
                )}
              </form.Field>

              {discoveredSources.length > 0 && (
                <div className="space-y-2 rounded-md border p-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
                  <div className="text-xs font-medium text-muted-foreground">
                    {_(msg`Found sources`)}
                  </div>
                  {discoveredSources.map((subscription) => (
                    <button
                      type="button"
                      key={`${subscription.url}-${subscription.type}`}
                      className="w-full rounded-md border px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        form.setFieldValue('feedUrl', subscription.url);
                      }}
                    >
                      <div className="font-medium">{subscription.title || subscription.url}</div>
                      <div className="text-xs text-muted-foreground">{subscription.url}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <form.Field name="feedUrl">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>{_(msg`Feed URL`)}</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={_(msg`https://example.com/rss.xml`)}
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

          {mode === 'edit' && (
            <form.Field name="title">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>{_(msg`Feed title`)}</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder={_(msg`Use source title`)}
                    disabled={pending}
                  />
                </Field>
              )}
            </form.Field>
          )}

          <form.Field name="categoryId">
            {(field) => {
              const selectedOption =
                filteredCategoryOptions.find((option) => option.value === field.state.value) ??
                categoryOptions.find((option) => option.value === field.state.value) ??
                null;

              return (
                <Field>
                  <FieldLabel>{_(msg`Category`)}</FieldLabel>
                  <Combobox<CategoryOption>
                    value={selectedOption}
                    onValueChange={(value) => {
                      if (!value) {
                        return;
                      }
                      field.handleChange(value.value);
                      setCategorySearchQuery(value.label);
                    }}
                    inputValue={categorySearchQuery}
                    onInputValueChange={setCategorySearchQuery}
                    itemToStringLabel={(option) => option.label}
                    isItemEqualToValue={areCategoryOptionsEqual}
                    disabled={pending}
                  >
                    <ComboboxInput
                      placeholder={_(msg`Search categories`)}
                      className="w-full"
                      disabled={pending}
                    />
                    <ComboboxContent>
                      <ComboboxList>
                        <ComboboxEmpty>{_(msg`No categories found`)}</ComboboxEmpty>
                        {filteredCategoryOptions.map((option) => (
                          <ComboboxItem key={option.value} value={option}>
                            {option.label}
                          </ComboboxItem>
                        ))}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </Field>
              );
            }}
          </form.Field>

          {mode === 'edit' && (
            <div className="rounded-md border">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
                onClick={() => setShowAdvanced((prev) => !prev)}
              >
                {_(msg`Advanced settings`)}
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  className={cn('size-4 transition-transform', showAdvanced && 'rotate-180')}
                />
              </button>

              {showAdvanced ? (
                <div className="space-y-4 border-t px-3 py-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <form.Field name="userAgent">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>{_(msg`User agent`)}</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            disabled={pending}
                          />
                        </Field>
                      )}
                    </form.Field>

                    <form.Field name="username">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>{_(msg`HTTP username`)}</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            disabled={pending}
                          />
                        </Field>
                      )}
                    </form.Field>

                    <form.Field name="password">
                      {(field) => (
                        <Field className="sm:col-span-2">
                          <FieldLabel htmlFor={field.name}>{_(msg`HTTP password`)}</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="password"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            disabled={pending}
                          />
                        </Field>
                      )}
                    </form.Field>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <form.Field name="crawler">
                      {(field) => (
                        <label
                          htmlFor={field.name}
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                        >
                          <span className="text-sm">{_(msg`Use custom crawler`)}</span>
                          <Switch
                            id={field.name}
                            checked={field.state.value}
                            onCheckedChange={field.handleChange}
                            disabled={pending}
                          />
                        </label>
                      )}
                    </form.Field>

                    <form.Field name="disabled">
                      {(field) => (
                        <label
                          htmlFor={field.name}
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                        >
                          <span className="text-sm">{_(msg`Disable feed`)}</span>
                          <Switch
                            id={field.name}
                            checked={field.state.value}
                            onCheckedChange={field.handleChange}
                            disabled={pending}
                          />
                        </label>
                      )}
                    </form.Field>

                    <form.Field name="ignoreHttpCache">
                      {(field) => (
                        <label
                          htmlFor={field.name}
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                        >
                          <span className="text-sm">{_(msg`Ignore HTTP cache`)}</span>
                          <Switch
                            id={field.name}
                            checked={field.state.value}
                            onCheckedChange={field.handleChange}
                            disabled={pending}
                          />
                        </label>
                      )}
                    </form.Field>

                    <form.Field name="fetchViaProxy">
                      {(field) => (
                        <label
                          htmlFor={field.name}
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                        >
                          <span className="text-sm">{_(msg`Fetch via proxy`)}</span>
                          <Switch
                            id={field.name}
                            checked={field.state.value}
                            onCheckedChange={field.handleChange}
                            disabled={pending}
                          />
                        </label>
                      )}
                    </form.Field>
                  </div>

                  <form.Field name="scraperRules">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>{_(msg`Scraper rules`)}</FieldLabel>
                        <Textarea
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          rows={3}
                          disabled={pending}
                        />
                      </Field>
                    )}
                  </form.Field>

                  <form.Field name="rewriteRules">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>{_(msg`Rewrite rules`)}</FieldLabel>
                        <Textarea
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          rows={3}
                          disabled={pending}
                        />
                      </Field>
                    )}
                  </form.Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <form.Field name="blocklistRules">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>{_(msg`Blocklist rules`)}</FieldLabel>
                          <Textarea
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            rows={3}
                            disabled={pending}
                          />
                        </Field>
                      )}
                    </form.Field>

                    <form.Field name="keeplistRules">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>{_(msg`Keeplist rules`)}</FieldLabel>
                          <Textarea
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            rows={3}
                            disabled={pending}
                          />
                        </Field>
                      )}
                    </form.Field>
                  </div>
                </div>
              ) : null}
            </div>
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
              {mode === 'create' ? _(msg`Create feed`) : _(msg`Save changes`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
