import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface StringFormFieldApi {
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

interface BooleanFormFieldApi {
  state: {
    value: boolean;
  };
  handleChange: (value: boolean) => void;
}

interface CategoryOption {
  value: string;
  label: string;
}

interface FeedDetailsTabPanelProps {
  feedField: React.ElementType;
  onFeedSubmit: () => void;
  isFeedFormSubmitted: boolean;
  isPending: boolean;
  selectedDiscoveredUrl: string;
  feedUrlInputRef: React.RefObject<HTMLInputElement | null>;
  categoryOptions: CategoryOption[];
  filteredCategoryOptions: CategoryOption[];
  categorySearchQuery: string;
  areCategoryOptionsEqual: (a: CategoryOption | null, b: CategoryOption | null) => boolean;
  showAdvanced: boolean;
  onSetCategorySearchQuery: (query: string) => void;
  onOpenCreateCategory: () => void;
  onClearSelectedDiscoveredUrl: () => void;
  onToggleAdvanced: () => void;
}

export function FeedDetailsTabPanel({
  feedField,
  onFeedSubmit,
  isFeedFormSubmitted,
  isPending,
  selectedDiscoveredUrl,
  feedUrlInputRef,
  categoryOptions,
  filteredCategoryOptions,
  categorySearchQuery,
  areCategoryOptionsEqual,
  showAdvanced,
  onSetCategorySearchQuery,
  onOpenCreateCategory,
  onClearSelectedDiscoveredUrl,
  onToggleAdvanced,
}: FeedDetailsTabPanelProps) {
  const { _ } = useLingui();
  const FeedField = feedField;

  return (
    <form
      id="add-feed-form"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onFeedSubmit();
      }}
      className="space-y-4"
    >
      <FeedField name="url">
        {(field: StringFormFieldApi) => (
          <Field>
            <FieldLabel htmlFor="url">{_(msg`Feed URL`)}</FieldLabel>
            <Input
              id="url"
              ref={feedUrlInputRef}
              placeholder={_(msg`https://example.com/feed.xml`)}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => {
                field.handleChange(e.target.value);
                if (selectedDiscoveredUrl && e.target.value !== selectedDiscoveredUrl) {
                  onClearSelectedDiscoveredUrl();
                }
              }}
              disabled={isPending}
            />
            {selectedDiscoveredUrl && field.state.value === selectedDiscoveredUrl ? (
              <p className="text-xs text-muted-foreground">
                {_(msg`URL selected from discovered sources`)}
              </p>
            ) : null}
            <FieldError
              errors={
                field.state.meta.isTouched || isFeedFormSubmitted ? field.state.meta.errors : []
              }
            />
          </Field>
        )}
      </FeedField>

      <FeedField name="categoryId">
        {(field: StringFormFieldApi) => {
          const selectedCategory =
            categoryOptions.find((option) => option.value === field.state.value) ?? null;

          return (
            <Field>
              <FieldLabel>{_(msg`Category`)}</FieldLabel>
              <Combobox<CategoryOption>
                value={selectedCategory}
                onValueChange={(value) => {
                  if (!value) {
                    return;
                  }
                  field.handleChange(value.value);
                  onSetCategorySearchQuery(value.label);
                }}
                inputValue={categorySearchQuery}
                onInputValueChange={onSetCategorySearchQuery}
                itemToStringLabel={(option) => option.label}
                isItemEqualToValue={areCategoryOptionsEqual}
                disabled={isPending}
              >
                <ComboboxInput
                  id="category"
                  placeholder={_(msg`Search categories`)}
                  className="w-full"
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
                  field.state.meta.isTouched || isFeedFormSubmitted ? field.state.meta.errors : []
                }
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
                    onClick={onOpenCreateCategory}
                    disabled={isPending}
                  >
                    {_(msg`Create Category`)}
                  </Button>
                </div>
              </div>
            </Field>
          );
        }}
      </FeedField>

      <div className="rounded-md border">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
          onClick={onToggleAdvanced}
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
              <FeedField name="userAgent">
                {(field: StringFormFieldApi) => (
                  <Field>
                    <FieldLabel htmlFor="feed-user-agent">{_(msg`User agent`)}</FieldLabel>
                    <Input
                      id="feed-user-agent"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={isPending}
                    />
                  </Field>
                )}
              </FeedField>

              <FeedField name="username">
                {(field: StringFormFieldApi) => (
                  <Field>
                    <FieldLabel htmlFor="feed-username">{_(msg`HTTP username`)}</FieldLabel>
                    <Input
                      id="feed-username"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={isPending}
                    />
                  </Field>
                )}
              </FeedField>

              <FeedField name="password">
                {(field: StringFormFieldApi) => (
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="feed-password">{_(msg`HTTP password`)}</FieldLabel>
                    <Input
                      id="feed-password"
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={isPending}
                    />
                  </Field>
                )}
              </FeedField>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <FeedField name="crawler">
                {(field: BooleanFormFieldApi) => (
                  <label
                    htmlFor="feed-crawler"
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm">{_(msg`Download original content (crawler)`)}</span>
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
              </FeedField>

              <FeedField name="disabled">
                {(field: BooleanFormFieldApi) => (
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
              </FeedField>

              <FeedField name="ignoreHttpCache">
                {(field: BooleanFormFieldApi) => (
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
              </FeedField>

              <FeedField name="fetchViaProxy">
                {(field: BooleanFormFieldApi) => (
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
              </FeedField>
            </div>

            <FeedField name="scraperRules">
              {(field: StringFormFieldApi) => (
                <Field>
                  <FieldLabel htmlFor="feed-scraper-rules">{_(msg`Scraper rules`)}</FieldLabel>
                  <Textarea
                    id="feed-scraper-rules"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    rows={3}
                    disabled={isPending}
                  />
                </Field>
              )}
            </FeedField>

            <FeedField name="rewriteRules">
              {(field: StringFormFieldApi) => (
                <Field>
                  <FieldLabel htmlFor="feed-rewrite-rules">{_(msg`Rewrite rules`)}</FieldLabel>
                  <Textarea
                    id="feed-rewrite-rules"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    rows={3}
                    disabled={isPending}
                  />
                </Field>
              )}
            </FeedField>

            <div className="grid gap-3 sm:grid-cols-2">
              <FeedField name="blocklistRules">
                {(field: StringFormFieldApi) => (
                  <Field>
                    <FieldLabel htmlFor="feed-blocklist-rules">
                      {_(msg`Blocklist rules`)}
                    </FieldLabel>
                    <Textarea
                      id="feed-blocklist-rules"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      rows={3}
                      disabled={isPending}
                    />
                  </Field>
                )}
              </FeedField>

              <FeedField name="keeplistRules">
                {(field: StringFormFieldApi) => (
                  <Field>
                    <FieldLabel htmlFor="feed-keeplist-rules">{_(msg`Keeplist rules`)}</FieldLabel>
                    <Textarea
                      id="feed-keeplist-rules"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      rows={3}
                      disabled={isPending}
                    />
                  </Field>
                )}
              </FeedField>
            </div>
          </div>
        ) : null}
      </div>
    </form>
  );
}
