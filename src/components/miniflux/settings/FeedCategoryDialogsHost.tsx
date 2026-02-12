import { useIsConnected } from '@/services/miniflux/auth';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
} from '@/services/miniflux/categories';
import { useCreateFeed, useUpdateFeed } from '@/services/miniflux/feeds';
import { CategoryFormDialog } from './CategoryFormDialog';
import {
  type FeedAdvancedValues,
  FeedFormDialog,
  type FeedFormSubmitInput,
} from './FeedFormDialog';
import { useMinifluxSettingsDialogStore } from './store';

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export function FeedCategoryDialogsHost() {
  const { data: isConnected } = useIsConnected();
  const { data: categories = [] } = useCategories(isConnected ?? false);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const createFeed = useCreateFeed();
  const updateFeed = useUpdateFeed();

  const categoryDialogState = useMinifluxSettingsDialogStore((state) => state.categoryDialogState);
  const setCategoryDialogState = useMinifluxSettingsDialogStore(
    (state) => state.setCategoryDialogState
  );
  const feedDialogState = useMinifluxSettingsDialogStore((state) => state.feedDialogState);
  const setFeedDialogState = useMinifluxSettingsDialogStore((state) => state.setFeedDialogState);

  const isCategoryDialogPending = createCategory.isPending || updateCategory.isPending;
  const isFeedDialogPending = createFeed.isPending || updateFeed.isPending;

  const handleSubmitCategory = async (title: string) => {
    if (!categoryDialogState) {
      return;
    }

    if (categoryDialogState.mode === 'create') {
      await createCategory.mutateAsync(title);
    } else {
      await updateCategory.mutateAsync({
        id: categoryDialogState.category.id,
        title,
      });
    }

    setCategoryDialogState(null);
  };

  const handleSubmitFeed = async (input: FeedFormSubmitInput) => {
    if (!feedDialogState) {
      return;
    }

    if (feedDialogState.mode === 'create') {
      await createFeed.mutateAsync({
        feedUrl: input.feedUrl,
        categoryId: input.categoryId,
      });
    } else {
      const advanced = input.advanced;
      await updateFeed.mutateAsync({
        id: feedDialogState.feed.id,
        updates: {
          // biome-ignore lint/style/useNamingConvention: API field names
          feed_url: input.feedUrl,
          title: input.title || null,
          // biome-ignore lint/style/useNamingConvention: API field names
          category_id: input.categoryId,
          // biome-ignore lint/style/useNamingConvention: API field names
          user_agent: advanced ? normalizeOptionalText(advanced.userAgent) : null,
          username: advanced ? normalizeOptionalText(advanced.username) : null,
          password: advanced ? normalizeOptionalText(advanced.password) : null,
          // biome-ignore lint/style/useNamingConvention: API field names
          scraper_rules: advanced ? normalizeOptionalText(advanced.scraperRules) : null,
          // biome-ignore lint/style/useNamingConvention: API field names
          rewrite_rules: advanced ? normalizeOptionalText(advanced.rewriteRules) : null,
          // biome-ignore lint/style/useNamingConvention: API field names
          blocklist_rules: advanced ? normalizeOptionalText(advanced.blocklistRules) : null,
          // biome-ignore lint/style/useNamingConvention: API field names
          keeplist_rules: advanced ? normalizeOptionalText(advanced.keeplistRules) : null,
          crawler: advanced?.crawler ?? false,
          disabled: advanced?.disabled ?? false,
          // biome-ignore lint/style/useNamingConvention: API field names
          ignore_http_cache: advanced?.ignoreHttpCache ?? false,
          // biome-ignore lint/style/useNamingConvention: API field names
          fetch_via_proxy: advanced?.fetchViaProxy ?? false,
        },
      });
    }

    setFeedDialogState(null);
  };

  return (
    <>
      {categoryDialogState && (
        <CategoryFormDialog
          key={
            categoryDialogState.mode === 'create'
              ? 'create-category'
              : `edit-category-${categoryDialogState.category.id}`
          }
          open
          mode={categoryDialogState.mode}
          initialTitle={
            categoryDialogState.mode === 'create' ? '' : categoryDialogState.category.title
          }
          pending={isCategoryDialogPending}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setCategoryDialogState(null);
            }
          }}
          onSubmit={handleSubmitCategory}
        />
      )}

      {feedDialogState && (
        <FeedFormDialog
          key={
            feedDialogState.mode === 'create'
              ? `create-feed-${feedDialogState.defaultCategoryId ?? 'none'}-${feedDialogState.initialFeedUrl ?? ''}`
              : `edit-feed-${feedDialogState.feed.id}`
          }
          open
          mode={feedDialogState.mode}
          initialFeedUrl={
            feedDialogState.mode === 'create'
              ? feedDialogState.initialFeedUrl
              : feedDialogState.feed.feed_url
          }
          initialTitle={feedDialogState.mode === 'create' ? '' : feedDialogState.feed.title}
          initialCategoryId={
            feedDialogState.mode === 'create'
              ? feedDialogState.defaultCategoryId
              : (feedDialogState.feed.category?.id ?? null)
          }
          initialAdvanced={
            feedDialogState.mode === 'create'
              ? undefined
              : {
                  userAgent: feedDialogState.feed.user_agent ?? '',
                  username: feedDialogState.feed.username ?? '',
                  password: feedDialogState.feed.password ?? '',
                  scraperRules: feedDialogState.feed.scraper_rules ?? '',
                  rewriteRules: feedDialogState.feed.rewrite_rules ?? '',
                  blocklistRules: feedDialogState.feed.blocklist_rules ?? '',
                  keeplistRules: feedDialogState.feed.keeplist_rules ?? '',
                  crawler: feedDialogState.feed.crawler ?? false,
                  disabled: feedDialogState.feed.disabled ?? false,
                  ignoreHttpCache: feedDialogState.feed.ignore_http_cache ?? false,
                  fetchViaProxy: feedDialogState.feed.fetch_via_proxy ?? false,
                }
          }
          showAdvancedByDefault={
            feedDialogState.mode === 'edit' &&
            hasAdvancedDefaults({
              userAgent: feedDialogState.feed.user_agent ?? '',
              username: feedDialogState.feed.username ?? '',
              password: feedDialogState.feed.password ?? '',
              scraperRules: feedDialogState.feed.scraper_rules ?? '',
              rewriteRules: feedDialogState.feed.rewrite_rules ?? '',
              blocklistRules: feedDialogState.feed.blocklist_rules ?? '',
              keeplistRules: feedDialogState.feed.keeplist_rules ?? '',
              crawler: feedDialogState.feed.crawler ?? false,
              disabled: feedDialogState.feed.disabled ?? false,
              ignoreHttpCache: feedDialogState.feed.ignore_http_cache ?? false,
              fetchViaProxy: feedDialogState.feed.fetch_via_proxy ?? false,
            })
          }
          categories={categories}
          pending={isFeedDialogPending}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setFeedDialogState(null);
            }
          }}
          onSubmit={handleSubmitFeed}
        />
      )}
    </>
  );
}
