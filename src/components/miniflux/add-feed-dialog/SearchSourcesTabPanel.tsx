import { Search01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type * as React from 'react';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import type { Subscription } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';

interface SourceSearchFormFieldApi {
  state: {
    value: string;
    meta: {
      isTouched: boolean;
      errors: (string | { message?: string } | undefined)[];
    };
  };
  handleBlur: () => void;
  handleChange: (value: string) => void;
}

interface SearchSourcesTabPanelProps {
  sourceUrlField: React.ElementType;
  onSearchSubmit: () => void;
  isSourceSearchSubmitted: boolean;
  searchSourcesPending: boolean;
  discoveredSources: Subscription[];
  hasSearchedSource: boolean;
  selectedDiscoveredUrl: string;
  onSelectDiscoveredSource: (url: string) => void;
}

export function SearchSourcesTabPanel({
  sourceUrlField,
  onSearchSubmit,
  isSourceSearchSubmitted,
  searchSourcesPending,
  discoveredSources,
  hasSearchedSource,
  selectedDiscoveredUrl,
  onSelectDiscoveredSource,
}: SearchSourcesTabPanelProps) {
  const { _ } = useLingui();
  const SourceUrlField = sourceUrlField;

  return (
    <>
      <p className="text-xs text-muted-foreground">
        {_(msg`Paste a website URL to discover available RSS/Atom feeds.`)}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSearchSubmit();
        }}
        className="space-y-4"
      >
        <SourceUrlField name="sourceUrl">
          {(field: SourceSearchFormFieldApi) => (
            <Field>
              <FieldLabel htmlFor="search-source-url">{_(msg`Search source URL`)}</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="search-source-url"
                  placeholder={_(msg`e.g. blog.example.com`)}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  disabled={searchSourcesPending}
                />
                <Button type="submit" variant="outline" size="lg" disabled={searchSourcesPending}>
                  {searchSourcesPending ? (
                    <Spinner className="mr-1.5 size-4" />
                  ) : (
                    <HugeiconsIcon icon={Search01Icon} className="mr-1.5 size-4" />
                  )}
                  {searchSourcesPending ? _(msg`Searching...`) : _(msg`Search`)}
                </Button>
              </div>
              <FieldError
                errors={
                  field.state.meta.isTouched || isSourceSearchSubmitted
                    ? field.state.meta.errors
                    : []
                }
              />
            </Field>
          )}
        </SourceUrlField>
      </form>

      {searchSourcesPending ? (
        <div className="space-y-2 rounded-md border p-2">
          <div className="text-xs font-medium text-muted-foreground">{_(msg`Found sources`)}</div>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`search-source-skeleton-${index + 1}`}
              className="rounded-md border px-2 py-1.5"
            >
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full max-w-[260px]" />
              </div>
            </div>
          ))}
        </div>
      ) : discoveredSources.length > 0 ? (
        <div className="space-y-2 rounded-md border p-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
          <div className="text-xs font-medium text-muted-foreground">{_(msg`Found sources`)}</div>
          {discoveredSources.map((subscription) => (
            <button
              type="button"
              key={`${subscription.url}-${subscription.type}`}
              className={cn(
                'w-full rounded-md border px-2 py-1.5 text-left text-sm transition-colors hover:bg-black/[0.06] dark:hover:bg-white/10',
                selectedDiscoveredUrl === subscription.url && 'border-primary/50 bg-primary/5'
              )}
              onClick={() => onSelectDiscoveredSource(subscription.url)}
            >
              <div className="font-medium">{subscription.title || subscription.url}</div>
              <div className="mt-0.5 flex items-center gap-2">
                <div className="truncate text-xs text-muted-foreground">{subscription.url}</div>
                {subscription.type ? (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {subscription.type}
                  </span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : hasSearchedSource ? (
        <p className="text-sm text-muted-foreground">{_(msg`No sources found`)}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {_(msg`Search a website first, then select one source to continue.`)}
        </p>
      )}
    </>
  );
}
