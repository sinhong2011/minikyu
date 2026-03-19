import { Add01Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useForm, useStore } from '@tanstack/react-form';
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
import { FeedDetailsTabPanel } from '@/components/miniflux/add-feed-dialog/FeedDetailsTabPanel';
import { SearchSourcesTabPanel } from '@/components/miniflux/add-feed-dialog/SearchSourcesTabPanel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import type { Category, FeedUpdate, Subscription } from '@/lib/tauri-bindings';
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

interface AddFeedFormValues extends FeedAdvancedFormValues {
  url: string;
  categoryId: string;
}

const ADD_FEED_FORM_DEFAULT_VALUES: AddFeedFormValues = {
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
};

const SOURCE_SEARCH_FORM_DEFAULT_VALUES = {
  sourceUrl: '',
};

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

function dedupeSubscriptions(subscriptions: Subscription[]): Subscription[] {
  const seen = new Set<string>();
  const uniqueSubscriptions: Subscription[] = [];

  for (const subscription of subscriptions) {
    const normalizedUrl = subscription.url.trim();
    if (!normalizedUrl) {
      continue;
    }

    const key = `${normalizedUrl}::${subscription.type ?? ''}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    if (normalizedUrl === subscription.url) {
      uniqueSubscriptions.push(subscription);
      continue;
    }

    uniqueSubscriptions.push({
      ...subscription,
      url: normalizedUrl,
    });
  }

  return uniqueSubscriptions;
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
  const latestSourceSearchRequestIdRef = React.useRef(0);

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
    const query = categorySearchQuery.trim().toLocaleLowerCase();
    if (!query) {
      return categoryOptions;
    }
    return categoryOptions.filter((option) => option.label.toLocaleLowerCase().includes(query));
  }, [categoryOptions, categorySearchQuery]);

  const feedFormSchema = React.useMemo(
    () =>
      z.object({
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
    [_]
  );

  const sourceSearchFormSchema = React.useMemo(
    () =>
      z.object({
        sourceUrl: z
          .string()
          .trim()
          .min(1, _(msg`Source URL is required`))
          .refine((value) => isValidSourceUrl(value), _(msg`Please enter a valid source URL`)),
      }),
    [_]
  );

  const form = useForm({
    defaultValues: { ...ADD_FEED_FORM_DEFAULT_VALUES },
    validators: {
      onChange: feedFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (createFeed.isPending) {
        return;
      }

      const normalizedFeedUrl = value.url.trim();
      const normalizedCategoryId = value.categoryId.trim();
      if (!normalizedFeedUrl || !normalizedCategoryId) {
        return;
      }

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
          feedUrl: normalizedFeedUrl,
          categoryId: normalizedCategoryId,
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
    defaultValues: { ...SOURCE_SEARCH_FORM_DEFAULT_VALUES },
    validators: {
      onChange: sourceSearchFormSchema,
    },
    onSubmit: async ({ value }) => {
      const requestId = latestSourceSearchRequestIdRef.current + 1;
      latestSourceSearchRequestIdRef.current = requestId;

      setSelectedDiscoveredUrl('');
      setDiscoveredSources([]);
      setHasSearchedSource(false);

      try {
        const results = await searchSources.mutateAsync(normalizeSourceUrl(value.sourceUrl));
        if (requestId !== latestSourceSearchRequestIdRef.current) {
          return;
        }

        setDiscoveredSources(dedupeSubscriptions(results));
        setHasSearchedSource(true);
      } catch {
        if (requestId !== latestSourceSearchRequestIdRef.current) {
          return;
        }

        setDiscoveredSources([]);
        setHasSearchedSource(true);
      }
    },
  });

  const resetDialogState = React.useCallback(() => {
    latestSourceSearchRequestIdRef.current += 1;
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
  }, [form, sourceSearchForm]);

  React.useEffect(() => {
    if (!open) {
      resetDialogState();
    }
  }, [open, resetDialogState]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const nextInitialUrl = initialFeedUrl?.trim();
    if (!nextInitialUrl) {
      return;
    }

    form.setFieldValue('url', normalizeSourceUrl(nextInitialUrl));
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

  const handleSelectDiscoveredSource = React.useCallback(
    (feedUrl: string) => {
      form.setFieldValue('url', feedUrl);
      setSelectedDiscoveredUrl(feedUrl);
      setActiveTab('feed');

      requestAnimationFrame(() => {
        feedUrlInputRef.current?.focus();
      });
    },
    [form]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] h-[55vh] overflow-hidden p-6 gap-6 flex flex-col duration-200 data-open:slide-in-from-bottom-2 data-closed:slide-out-to-bottom-2">
        <DialogHeader className="shrink-0">
          <DialogTitle>{_(msg`Add New Feed`)}</DialogTitle>
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
            <TabsPanel
              value="search"
              className="h-full space-y-4 overflow-y-auto overflow-x-hidden pr-1 pt-1"
            >
              <SearchSourcesTabPanel
                sourceUrlField={sourceSearchForm.Field}
                onSearchSubmit={sourceSearchForm.handleSubmit}
                isSourceSearchSubmitted={sourceSearchForm.state.isSubmitted}
                searchSourcesPending={searchSources.isPending}
                discoveredSources={discoveredSources}
                hasSearchedSource={hasSearchedSource}
                selectedDiscoveredUrl={selectedDiscoveredUrl}
                onSelectDiscoveredSource={handleSelectDiscoveredSource}
              />
            </TabsPanel>

            <TabsPanel value="feed" className="h-full overflow-y-auto overflow-x-hidden pr-1 pt-1">
              <FeedDetailsTabPanel
                feedField={form.Field}
                onFeedSubmit={form.handleSubmit}
                isFeedFormSubmitted={form.state.isSubmitted}
                isPending={isPending}
                selectedDiscoveredUrl={selectedDiscoveredUrl}
                feedUrlInputRef={feedUrlInputRef}
                categoryOptions={categoryOptions}
                filteredCategoryOptions={filteredCategoryOptions}
                categorySearchQuery={categorySearchQuery}
                areCategoryOptionsEqual={areCategoryOptionsEqual}
                showAdvanced={showAdvanced}
                onSetCategorySearchQuery={setCategorySearchQuery}
                onOpenCreateCategory={() => setAddCategoryOpen(true)}
                onClearSelectedDiscoveredUrl={() => setSelectedDiscoveredUrl('')}
                onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
              />
            </TabsPanel>
          </TabsPanels>
        </Tabs>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {_(msg`Cancel`)}
          </Button>
          {activeTab === 'search' ? (
            <Button type="button" onClick={() => setActiveTab('feed')}>
              {_(msg`Continue to Add Feed`)}
            </Button>
          ) : (
            <Button
              type="submit"
              form="add-feed-form"
              disabled={isPending || !hasRequiredFeedFields}
            >
              {isPending ? <Spinner className="mr-1.5 size-4" /> : null}
              {isPending ? _(msg`Adding...`) : _(msg`Add Feed`)}
            </Button>
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
