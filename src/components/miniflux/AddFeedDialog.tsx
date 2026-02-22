import { Add01Icon, ArrowDown01Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useForm, useStore } from '@tanstack/react-form';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';
import { z } from 'zod';
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsPanels,
  TabsTab,
} from '@/components/animate-ui/components/base/tabs';
import { AddCategoryDialog } from '@/components/miniflux/AddCategoryDialog';
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
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { Category, FeedUpdate, Subscription } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { useCategories } from '@/services/miniflux/categories';
import { useCreateFeed, useSearchSources } from '@/services/miniflux/feeds';

interface AddFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFeedUrl?: string;
  initialSearchOpen?: boolean;
}

interface CategoryOption {
  value: string;
  label: string;
}

interface FeedAdvancedFormValues {
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

type FeedModalTab = 'search' | 'feed';

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSourceUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isValidSourceUrl(value: string): boolean {
  try {
    const normalized = normalizeSourceUrl(value);
    if (!normalized) {
      return false;
    }
    const parsed = new URL(normalized);
    return parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function buildAddFeedAdvancedUpdates(values: FeedAdvancedFormValues): FeedUpdate | undefined {
  const updates: FeedUpdate = {};

  const userAgent = normalizeOptionalText(values.userAgent);
  if (userAgent !== null) {
    updates.user_agent = userAgent;
  }

  const username = normalizeOptionalText(values.username);
  if (username !== null) {
    updates.username = username;
  }

  const password = normalizeOptionalText(values.password);
  if (password !== null) {
    updates.password = password;
  }

  const scraperRules = normalizeOptionalText(values.scraperRules);
  if (scraperRules !== null) {
    updates.scraper_rules = scraperRules;
  }

  const rewriteRules = normalizeOptionalText(values.rewriteRules);
  if (rewriteRules !== null) {
    updates.rewrite_rules = rewriteRules;
  }

  const blocklistRules = normalizeOptionalText(values.blocklistRules);
  if (blocklistRules !== null) {
    updates.blocklist_rules = blocklistRules;
  }

  const keeplistRules = normalizeOptionalText(values.keeplistRules);
  if (keeplistRules !== null) {
    updates.keeplist_rules = keeplistRules;
  }

  if (values.crawler) {
    updates.crawler = true;
  }

  if (values.disabled) {
    updates.disabled = true;
  }

  if (values.ignoreHttpCache) {
    updates.ignore_http_cache = true;
  }

  if (values.fetchViaProxy) {
    updates.fetch_via_proxy = true;
  }

  return Object.values(updates).some((value) => value !== undefined) ? updates : undefined;
}

export function AddFeedDialog({
  open,
  onOpenChange,
  initialFeedUrl,
  initialSearchOpen = false,
}: AddFeedDialogProps) {
  const { _ } = useLingui();
  const { data: categories } = useCategories();
  const createFeed = useCreateFeed();
  const searchSources = useSearchSources();
  const [createdOptions, setCreatedOptions] = React.useState<CategoryOption[]>([]);
  const [addCategoryOpen, setAddCategoryOpen] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<FeedModalTab>('feed');
  const [discoveredSources, setDiscoveredSources] = React.useState<Subscription[]>([]);
  const [hasSearchedSource, setHasSearchedSource] = React.useState(false);
  const [selectedDiscoveredUrl, setSelectedDiscoveredUrl] = React.useState('');
  const [categorySearchQuery, setCategorySearchQuery] = React.useState('');
  const feedUrlInputRef = React.useRef<HTMLInputElement>(null);

  const categoryOptions = React.useMemo<CategoryOption[]>(() => {
    const baseOptions = (categories ?? []).map((category) => ({
      value: String(category.id),
      label: category.title,
    }));

    const merged = new Map<string, CategoryOption>();
    for (const option of [...baseOptions, ...createdOptions]) {
      merged.set(option.value, option);
    }
    return [...merged.values()];
  }, [categories, createdOptions]);

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

  const form = useForm({
    defaultValues: {
      url: '',
      categoryId: '',
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
    },
    validators: {
      onChange: z.object({
        url: z.string().url(_(msg`Please enter a valid URL`)),
        categoryId: z.string().min(1, _(msg`Category is required`)),
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
      }),
    },
    onSubmit: async ({ value }) => {
      const advancedUpdates = buildAddFeedAdvancedUpdates({
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
      });

      try {
        await createFeed.mutateAsync({
          feedUrl: value.url,
          categoryId: value.categoryId,
          updates: advancedUpdates,
        });
        onOpenChange(false);
      } catch {
        // Error is handled by mutation toast
      }
    },
  });

  const handleCategoryCreated = React.useCallback(
    (category: Category) => {
      const nextOption = {
        value: String(category.id),
        label: category.title,
      };
      setCreatedOptions((prev) => {
        if (prev.some((option) => option.value === nextOption.value)) {
          return prev;
        }
        return [...prev, nextOption];
      });
      form.setFieldValue('categoryId', String(category.id));
      setCategorySearchQuery(category.title);
    },
    [form]
  );

  const sourceSearchForm = useForm({
    defaultValues: {
      sourceUrl: '',
    },
    validators: {
      onChange: z.object({
        sourceUrl: z
          .string()
          .trim()
          .min(1, _(msg`Source URL is required`))
          .refine((value) => isValidSourceUrl(value), _(msg`Please enter a valid source URL`)),
      }),
    },
    onSubmit: async ({ value }) => {
      setDiscoveredSources([]);
      setHasSearchedSource(false);

      try {
        const results = await searchSources.mutateAsync(normalizeSourceUrl(value.sourceUrl));
        setDiscoveredSources(results);
        setHasSearchedSource(true);
      } catch {
        setDiscoveredSources([]);
        setHasSearchedSource(true);
      }
    },
  });

  React.useEffect(() => {
    if (!open) {
      setCreatedOptions([]);
      setAddCategoryOpen(false);
      setShowAdvanced(false);
      setActiveTab('feed');
      setDiscoveredSources([]);
      setHasSearchedSource(false);
      setSelectedDiscoveredUrl('');
      setCategorySearchQuery('');
      form.reset();
      sourceSearchForm.reset();
    }
  }, [open, form, sourceSearchForm]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const nextInitialUrl = initialFeedUrl?.trim();
    if (!nextInitialUrl) {
      return;
    }

    form.setFieldValue('url', nextInitialUrl);
    setSelectedDiscoveredUrl('');
  }, [open, initialFeedUrl, form]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setActiveTab(initialSearchOpen ? 'search' : 'feed');
  }, [open, initialSearchOpen]);

  const isPending = createFeed.isPending;
  const formValues = useStore(form.store, (state) => state.values);
  const urlValue = formValues.url?.trim() ?? '';
  const categoryIdValue = formValues.categoryId?.trim() ?? '';
  const hasRequiredFeedFields = urlValue.length > 0 && categoryIdValue.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] h-[calc(86vh-350px)] max-h-[calc(86vh-350px)] overflow-hidden p-6 gap-4 flex flex-col duration-200 data-open:slide-in-from-bottom-2 data-closed:slide-out-to-bottom-2">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HugeiconsIcon icon={Add01Icon} className="size-5" />
            {_(msg`Add New Feed`)}
          </DialogTitle>
          <DialogDescription>
            {_(msg`Search source first, then confirm feed details before subscribing.`)}
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as FeedModalTab)}
          className="flex flex-col gap-3 min-h-0 flex-1"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTab value="search">
              <span className="inline-flex items-center gap-1.5">
                <HugeiconsIcon icon={Search01Icon} className="size-4" />
                {_(msg`Search Source`)}
              </span>
            </TabsTab>
            <TabsTab value="feed">
              <span className="inline-flex items-center gap-1.5">
                <HugeiconsIcon icon={Add01Icon} className="size-4" />
                {_(msg`Add Feed`)}
              </span>
            </TabsTab>
          </TabsList>

          <TabsPanels mode="layout" className="min-h-0 flex-1">
            <TabsPanel value="search" className="h-full space-y-4 overflow-y-auto pr-1 pt-1">
              <p className="text-xs text-muted-foreground">
                {_(msg`Paste a website URL to discover available RSS/Atom feeds.`)}
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  sourceSearchForm.handleSubmit();
                }}
                className="space-y-3"
              >
                <div className="space-y-2">
                  <Label htmlFor="search-source-url">{_(msg`Search source URL`)}</Label>
                  <sourceSearchForm.Field name="sourceUrl">
                    {(field) => (
                      <div className="space-y-1">
                        <Input
                          id="search-source-url"
                          placeholder={_(msg`e.g. blog.example.com`)}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          disabled={searchSources.isPending}
                        />
                        <FieldError
                          errors={
                            field.state.meta.isTouched || sourceSearchForm.state.isSubmitted
                              ? field.state.meta.errors
                              : []
                          }
                          className="text-[0.8rem] font-medium"
                        />
                      </div>
                    )}
                  </sourceSearchForm.Field>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="outline" disabled={searchSources.isPending}>
                    {searchSources.isPending ? (
                      <Spinner className="mr-1.5 size-4" />
                    ) : (
                      <HugeiconsIcon icon={Search01Icon} className="mr-1.5 size-4" />
                    )}
                    {searchSources.isPending ? _(msg`Searching...`) : _(msg`Search Source`)}
                  </Button>
                </div>
              </form>

              {searchSources.isPending ? (
                <div className="space-y-2 rounded-md border p-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    {_(msg`Found sources`)}
                  </div>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={`search-source-skeleton-${index + 1}`}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3 w-full max-w-[260px]" />
                          <Skeleton className="h-4 w-12 rounded-full" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-18 shrink-0" />
                    </div>
                  ))}
                </div>
              ) : discoveredSources.length > 0 ? (
                <div className="space-y-2 rounded-md border p-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
                  <div className="text-xs font-medium text-muted-foreground">
                    {_(msg`Found sources`)}
                  </div>
                  {discoveredSources.map((subscription) => (
                    <div
                      key={`${subscription.url}-${subscription.type}`}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors',
                        selectedDiscoveredUrl === subscription.url &&
                          'border-primary/50 bg-primary/5'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {subscription.title || subscription.url}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <p className="truncate text-xs text-muted-foreground">
                            {subscription.url}
                          </p>
                          {subscription.type ? (
                            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {subscription.type}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          form.setFieldValue('url', subscription.url);
                          setSelectedDiscoveredUrl(subscription.url);
                          setActiveTab('feed');
                          requestAnimationFrame(() => {
                            feedUrlInputRef.current?.focus();
                          });
                        }}
                      >
                        {_(msg`Use URL`)}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : hasSearchedSource ? (
                <p className="text-sm text-muted-foreground">{_(msg`No sources found`)}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {_(msg`Search a website first, then select one source to continue.`)}
                </p>
              )}
            </TabsPanel>

            <TabsPanel value="feed" className="h-full overflow-y-auto pr-1 pt-1">
              <form
                id="add-feed-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
                }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label htmlFor="url">{_(msg`Feed URL`)}</Label>
                  <form.Field name="url">
                    {(field) => (
                      <div className="space-y-1">
                        <Input
                          id="url"
                          ref={feedUrlInputRef}
                          placeholder={_(msg`https://example.com/feed.xml`)}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => {
                            field.handleChange(e.target.value);
                            if (selectedDiscoveredUrl && e.target.value !== selectedDiscoveredUrl) {
                              setSelectedDiscoveredUrl('');
                            }
                          }}
                          disabled={isPending}
                        />
                        {selectedDiscoveredUrl && field.state.value === selectedDiscoveredUrl ? (
                          <p className="text-[0.8rem] font-medium text-muted-foreground">
                            {_(msg`URL selected from discovered sources`)}
                          </p>
                        ) : null}
                        <FieldError
                          errors={
                            field.state.meta.isTouched || form.state.isSubmitted
                              ? field.state.meta.errors
                              : []
                          }
                          className="text-[0.8rem] font-medium"
                        />
                      </div>
                    )}
                  </form.Field>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">{_(msg`Category`)}</Label>
                  <form.Field name="categoryId">
                    {(field) => {
                      const selectedCategory =
                        categoryOptions.find((option) => option.value === field.state.value) ??
                        null;

                      return (
                        <div className="space-y-1">
                          <Combobox<CategoryOption>
                            value={selectedCategory}
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
                            disabled={isPending}
                          >
                            <ComboboxInput
                              id="category"
                              placeholder={_(msg`Search categories`)}
                              className={cn(
                                'w-full',
                                field.state.meta.errors.length > 0 ? 'border-destructive' : ''
                              )}
                              disabled={isPending}
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
                          <FieldError
                            errors={
                              field.state.meta.isTouched || form.state.isSubmitted
                                ? field.state.meta.errors
                                : []
                            }
                            className="text-[0.8rem] font-medium"
                          />
                          <div className="rounded-md border border-dashed px-2 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-muted-foreground">
                                {_(msg`Can’t find a category? Create a new one.`)}
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 shrink-0"
                                onClick={() => setAddCategoryOpen(true)}
                                disabled={isPending}
                              >
                                {_(msg`Create Category`)}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  </form.Field>
                </div>

                <div className="rounded-md border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
                    onClick={() => setShowAdvanced((prev) => !prev)}
                  >
                    {_(msg`Advanced settings`)}
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      className={`size-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {showAdvanced ? (
                    <div className="space-y-4 border-t px-3 py-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <form.Field name="userAgent">
                          {(field) => (
                            <div className="space-y-1.5">
                              <Label htmlFor="feed-user-agent">{_(msg`User agent`)}</Label>
                              <Input
                                id="feed-user-agent"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                disabled={isPending}
                              />
                            </div>
                          )}
                        </form.Field>

                        <form.Field name="username">
                          {(field) => (
                            <div className="space-y-1.5">
                              <Label htmlFor="feed-username">{_(msg`HTTP username`)}</Label>
                              <Input
                                id="feed-username"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                disabled={isPending}
                              />
                            </div>
                          )}
                        </form.Field>

                        <form.Field name="password">
                          {(field) => (
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label htmlFor="feed-password">{_(msg`HTTP password`)}</Label>
                              <Input
                                id="feed-password"
                                type="password"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                disabled={isPending}
                              />
                            </div>
                          )}
                        </form.Field>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <form.Field name="crawler">
                          {(field) => (
                            <label
                              htmlFor="feed-crawler"
                              className="flex items-center justify-between rounded-md border px-3 py-2"
                            >
                              <span className="flex flex-col gap-0.5">
                                <span className="text-sm">
                                  {_(msg`Download original content (crawler)`)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {_(msg`Useful for summary-only feeds`)}
                                </span>
                              </span>
                              <Switch
                                id="feed-crawler"
                                checked={field.state.value}
                                onCheckedChange={field.handleChange}
                                disabled={isPending}
                              />
                            </label>
                          )}
                        </form.Field>

                        <form.Field name="disabled">
                          {(field) => (
                            <label
                              htmlFor="feed-disabled"
                              className="flex items-center justify-between rounded-md border px-3 py-2"
                            >
                              <span className="text-sm">{_(msg`Disable feed`)}</span>
                              <Switch
                                id="feed-disabled"
                                checked={field.state.value}
                                onCheckedChange={field.handleChange}
                                disabled={isPending}
                              />
                            </label>
                          )}
                        </form.Field>

                        <form.Field name="ignoreHttpCache">
                          {(field) => (
                            <label
                              htmlFor="feed-ignore-http-cache"
                              className="flex items-center justify-between rounded-md border px-3 py-2"
                            >
                              <span className="text-sm">{_(msg`Ignore HTTP cache`)}</span>
                              <Switch
                                id="feed-ignore-http-cache"
                                checked={field.state.value}
                                onCheckedChange={field.handleChange}
                                disabled={isPending}
                              />
                            </label>
                          )}
                        </form.Field>

                        <form.Field name="fetchViaProxy">
                          {(field) => (
                            <label
                              htmlFor="feed-fetch-via-proxy"
                              className="flex items-center justify-between rounded-md border px-3 py-2"
                            >
                              <span className="text-sm">{_(msg`Fetch via proxy`)}</span>
                              <Switch
                                id="feed-fetch-via-proxy"
                                checked={field.state.value}
                                onCheckedChange={field.handleChange}
                                disabled={isPending}
                              />
                            </label>
                          )}
                        </form.Field>
                      </div>

                      <form.Field name="scraperRules">
                        {(field) => (
                          <div className="space-y-1.5">
                            <Label htmlFor="feed-scraper-rules">{_(msg`Scraper rules`)}</Label>
                            <Textarea
                              id="feed-scraper-rules"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              rows={3}
                              disabled={isPending}
                            />
                          </div>
                        )}
                      </form.Field>

                      <form.Field name="rewriteRules">
                        {(field) => (
                          <div className="space-y-1.5">
                            <Label htmlFor="feed-rewrite-rules">{_(msg`Rewrite rules`)}</Label>
                            <Textarea
                              id="feed-rewrite-rules"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              rows={3}
                              disabled={isPending}
                            />
                          </div>
                        )}
                      </form.Field>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <form.Field name="blocklistRules">
                          {(field) => (
                            <div className="space-y-1.5">
                              <Label htmlFor="feed-blocklist-rules">
                                {_(msg`Blocklist rules`)}
                              </Label>
                              <Textarea
                                id="feed-blocklist-rules"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                rows={3}
                                disabled={isPending}
                              />
                            </div>
                          )}
                        </form.Field>

                        <form.Field name="keeplistRules">
                          {(field) => (
                            <div className="space-y-1.5">
                              <Label htmlFor="feed-keeplist-rules">{_(msg`Keeplist rules`)}</Label>
                              <Textarea
                                id="feed-keeplist-rules"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                rows={3}
                                disabled={isPending}
                              />
                            </div>
                          )}
                        </form.Field>
                      </div>
                    </div>
                  ) : null}
                </div>
              </form>
            </TabsPanel>
          </TabsPanels>
        </Tabs>

        <DialogFooter className="shrink-0 border-t border-border/50 pt-3">
          <Button
            type="button"
            variant="outline"
            className={'w-20'}
            onClick={() => onOpenChange(false)}
          >
            {_(msg`Cancel`)}
          </Button>
          {activeTab === 'search' ? (
            <Button type="button" onClick={() => setActiveTab('feed')}>
              <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-4" />
              {_(msg`Continue to Add Feed`)}
            </Button>
          ) : (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Button
                type="submit"
                form="add-feed-form"
                className="relative min-w-[5rem] overflow-hidden"
                disabled={isPending || !hasRequiredFeedFields}
              >
                <AnimatePresence mode="wait">
                  {isPending ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center justify-center"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: 'linear',
                        }}
                      >
                        <Spinner className="size-4" />
                      </motion.div>
                    </motion.div>
                  ) : (
                    <motion.span
                      key="idle"
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -10 }}
                      transition={{ duration: 0.15 }}
                    >
                      {_(msg`Add Feed`)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>
          )}
        </DialogFooter>
      </DialogContent>
      <AddCategoryDialog
        open={addCategoryOpen}
        onOpenChange={setAddCategoryOpen}
        onCreated={handleCategoryCreated}
      />
    </Dialog>
  );
}
