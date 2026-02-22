import { ArrowDown01Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { Feed, FeedUpdate } from '@/lib/tauri-bindings';
import { useCategories } from '@/services/miniflux/categories';
import { useUpdateFeed } from '@/services/miniflux/feeds';

interface EditFeedDialogProps {
  feed: Feed;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasAdvancedDefaults(feed: Feed): boolean {
  return Boolean(
    feed.user_agent ||
      feed.username ||
      feed.password ||
      feed.scraper_rules ||
      feed.rewrite_rules ||
      feed.blocklist_rules ||
      feed.keeplist_rules ||
      feed.crawler ||
      feed.disabled ||
      feed.ignore_http_cache ||
      feed.fetch_via_proxy
  );
}

export function EditFeedDialog({ feed, open, onOpenChange }: EditFeedDialogProps) {
  const { _ } = useLingui();
  const { data: categories } = useCategories();
  const updateFeed = useUpdateFeed();
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const form = useForm({
    defaultValues: {
      feedUrl: feed.feed_url,
      title: feed.title,
      categoryId: feed.category?.id.toString() ?? 'none',
      userAgent: feed.user_agent ?? '',
      username: feed.username ?? '',
      password: feed.password ?? '',
      scraperRules: feed.scraper_rules ?? '',
      rewriteRules: feed.rewrite_rules ?? '',
      blocklistRules: feed.blocklist_rules ?? '',
      keeplistRules: feed.keeplist_rules ?? '',
      crawler: feed.crawler ?? false,
      disabled: feed.disabled ?? false,
      ignoreHttpCache: feed.ignore_http_cache ?? false,
      fetchViaProxy: feed.fetch_via_proxy ?? false,
    },
    validators: {
      onChange: z.object({
        feedUrl: z.string().url(_(msg`Please enter a valid URL`)),
        title: z.string().trim().min(1, _(msg`Title is required`)),
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
      }),
    },
    onSubmit: async ({ value }) => {
      const updates: FeedUpdate = {};

      updates.feed_url = value.feedUrl.trim();
      updates.title = value.title.trim();
      updates.category_id = value.categoryId === 'none' ? null : value.categoryId;
      updates.user_agent = normalizeOptionalText(value.userAgent);
      updates.username = normalizeOptionalText(value.username);
      updates.password = normalizeOptionalText(value.password);
      updates.scraper_rules = normalizeOptionalText(value.scraperRules);
      updates.rewrite_rules = normalizeOptionalText(value.rewriteRules);
      updates.blocklist_rules = normalizeOptionalText(value.blocklistRules);
      updates.keeplist_rules = normalizeOptionalText(value.keeplistRules);
      updates.crawler = value.crawler;
      updates.disabled = value.disabled;
      updates.ignore_http_cache = value.ignoreHttpCache;
      updates.fetch_via_proxy = value.fetchViaProxy;

      try {
        await updateFeed.mutateAsync({
          id: feed.id,
          updates,
        });
        onOpenChange(false);
      } catch {
        // Error handled by mutation toast
      }
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        feedUrl: feed.feed_url,
        title: feed.title,
        categoryId: feed.category?.id.toString() ?? 'none',
        userAgent: feed.user_agent ?? '',
        username: feed.username ?? '',
        password: feed.password ?? '',
        scraperRules: feed.scraper_rules ?? '',
        rewriteRules: feed.rewrite_rules ?? '',
        blocklistRules: feed.blocklist_rules ?? '',
        keeplistRules: feed.keeplist_rules ?? '',
        crawler: feed.crawler ?? false,
        disabled: feed.disabled ?? false,
        ignoreHttpCache: feed.ignore_http_cache ?? false,
        fetchViaProxy: feed.fetch_via_proxy ?? false,
      });
      setShowAdvanced(hasAdvancedDefaults(feed));
    }
  }, [open, feed, form]);

  const isPending = updateFeed.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-hidden p-6 gap-6 flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HugeiconsIcon icon={PencilEdit02Icon} className="size-5" />
            {_(msg`Edit Feed`)}
          </DialogTitle>
          <DialogDescription>
            {_(msg`Update feed URL, category, and advanced feed settings.`)}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-6 overflow-y-auto min-h-0 pr-1"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-feed-url">{_(msg`Feed URL`)}</Label>
              <form.Field name="feedUrl">
                {(field) => (
                  <div className="space-y-1">
                    <Input
                      id="edit-feed-url"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={isPending}
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

            <div className="space-y-2">
              <Label htmlFor="edit-feed-title">{_(msg`Feed Title`)}</Label>
              <form.Field name="title">
                {(field) => (
                  <div className="space-y-1">
                    <Input
                      id="edit-feed-title"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={isPending}
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

            <div className="space-y-2">
              <Label htmlFor="edit-feed-category">{_(msg`Category`)}</Label>
              <form.Field name="categoryId">
                {(field) => (
                  <Select value={field.state.value} onValueChange={field.handleChange}>
                    <SelectTrigger id="edit-feed-category">
                      <SelectValue placeholder={_(msg`Select a category`)} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{_(msg`No category`)}</SelectItem>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
                <div className="space-y-4 border-t px-3 py-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <form.Field name="userAgent">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-feed-user-agent">{_(msg`User agent`)}</Label>
                          <Input
                            id="edit-feed-user-agent"
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
                          <Label htmlFor="edit-feed-username">{_(msg`HTTP username`)}</Label>
                          <Input
                            id="edit-feed-username"
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
                          <Label htmlFor="edit-feed-password">{_(msg`HTTP password`)}</Label>
                          <Input
                            id="edit-feed-password"
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
                          htmlFor="edit-feed-crawler"
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
                            id="edit-feed-crawler"
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
                          htmlFor="edit-feed-disabled"
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                        >
                          <span className="text-sm">{_(msg`Disable feed`)}</span>
                          <Switch
                            id="edit-feed-disabled"
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
                          htmlFor="edit-feed-ignore-http-cache"
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                        >
                          <span className="text-sm">{_(msg`Ignore HTTP cache`)}</span>
                          <Switch
                            id="edit-feed-ignore-http-cache"
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
                          htmlFor="edit-feed-fetch-via-proxy"
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                        >
                          <span className="text-sm">{_(msg`Fetch via proxy`)}</span>
                          <Switch
                            id="edit-feed-fetch-via-proxy"
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
                        <Label htmlFor="edit-feed-scraper-rules">{_(msg`Scraper rules`)}</Label>
                        <Textarea
                          id="edit-feed-scraper-rules"
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
                        <Label htmlFor="edit-feed-rewrite-rules">{_(msg`Rewrite rules`)}</Label>
                        <Textarea
                          id="edit-feed-rewrite-rules"
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
                          <Label htmlFor="edit-feed-blocklist-rules">
                            {_(msg`Blocklist rules`)}
                          </Label>
                          <Textarea
                            id="edit-feed-blocklist-rules"
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
                          <Label htmlFor="edit-feed-keeplist-rules">{_(msg`Keeplist rules`)}</Label>
                          <Textarea
                            id="edit-feed-keeplist-rules"
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {_(msg`Cancel`)}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? _(msg`Saving...`) : _(msg`Save Changes`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
