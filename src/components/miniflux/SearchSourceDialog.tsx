import { Search01Icon } from '@hugeicons/core-free-icons';
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
import { Spinner } from '@/components/ui/spinner';
import type { Subscription } from '@/lib/tauri-bindings';
import { useSearchSources } from '@/services/miniflux/feeds';

interface SearchSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSource?: (feedUrl: string) => void;
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
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

export function SearchSourceDialog({
  open,
  onOpenChange,
  onSelectSource,
}: SearchSourceDialogProps) {
  const { _ } = useLingui();
  const searchSources = useSearchSources();
  const [discoveredSources, setDiscoveredSources] = React.useState<Subscription[]>([]);
  const [hasSearched, setHasSearched] = React.useState(false);

  const formSchema = z.object({
    sourceUrl: z
      .string()
      .trim()
      .min(1, _(msg`Source URL is required`))
      .refine((value) => isValidUrl(value), _(msg`Please enter a valid source URL`)),
  });

  const form = useForm({
    defaultValues: {
      sourceUrl: '',
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      setDiscoveredSources([]);
      setHasSearched(false);
      try {
        const results = await searchSources.mutateAsync(normalizeUrl(value.sourceUrl));
        setDiscoveredSources(results);
        setHasSearched(true);
      } catch {
        setDiscoveredSources([]);
        setHasSearched(true);
      }
    },
  });

  const resetDialogState = React.useCallback(() => {
    setDiscoveredSources([]);
    setHasSearched(false);
    form.reset();
  }, [form]);

  React.useEffect(() => {
    if (!open) {
      resetDialogState();
    }
  }, [open, resetDialogState]);

  const handleUseSource = (feedUrl: string) => {
    onSelectSource?.(feedUrl);
    onOpenChange(false);
    resetDialogState();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-6 gap-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HugeiconsIcon icon={Search01Icon} className="size-5" />
            {_(msg`Search Source`)}
          </DialogTitle>
          <DialogDescription>
            {_(msg`Search for websites or blog URLs to discover available feeds.`)}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="search-source-url">{_(msg`Search source URL`)}</Label>
            <form.Field name="sourceUrl">
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
                  {field.state.meta.errors ? (
                    <p className="text-[0.8rem] font-medium text-destructive">
                      {field.state.meta.errors.join(', ')}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {_(msg`Cancel`)}
            </Button>
            <Button type="submit" disabled={searchSources.isPending}>
              {searchSources.isPending ? (
                <Spinner className="mr-1.5 size-4" />
              ) : (
                <HugeiconsIcon icon={Search01Icon} className="mr-1.5 size-4" />
              )}
              {searchSources.isPending ? _(msg`Searching...`) : _(msg`Search`)}
            </Button>
          </DialogFooter>
        </form>

        {searchSources.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            <span>{_(msg`Searching sources...`)}</span>
          </div>
        ) : discoveredSources.length > 0 ? (
          <div className="space-y-2 rounded-md border p-3">
            <div className="text-xs font-medium text-muted-foreground">{_(msg`Found sources`)}</div>
            {discoveredSources.map((subscription) => (
              <div
                key={`${subscription.url}-${subscription.type}`}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {subscription.title || subscription.url}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{subscription.url}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleUseSource(subscription.url)}
                >
                  {_(msg`Use in Add Feed`)}
                </Button>
              </div>
            ))}
          </div>
        ) : hasSearched ? (
          <p className="text-sm text-muted-foreground">{_(msg`No sources found`)}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
