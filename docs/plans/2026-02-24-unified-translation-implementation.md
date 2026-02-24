# Unified Translation Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the two translation UIs (immersive translation + OpenCC Chinese conversion) into a single header popover and a single preferences pane, and add a feed-level translation exclusion list.

**Architecture:** Frontend-only changes for the header popover merge and feed exclusion logic. One new `Vec<String>` field in Rust `AppPreferences` for excluded feed IDs. Chinese conversion rules UI moves from AppearancePane to TranslationPane. The exclusion check happens in `EntryReading.tsx` before passing `translationEnabled` to the header and `ImmersiveTranslationLayer`.

**Tech Stack:** React 19, TypeScript, Tauri v2 (Rust backend), Zustand, TanStack Query, Lingui i18n, shadcn/ui components

---

### Task 1: Add `reader_translation_excluded_feed_ids` to Rust AppPreferences

**Files:**
- Modify: `src-tauri/src/types.rs:104-204` (AppPreferences struct + Default impl)

**Step 1: Add the field to AppPreferences struct**

In `src-tauri/src/types.rs`, add after `reader_translation_auto_enabled` (line 164):

```rust
    /// Feed IDs excluded from immersive translation.
    #[serde(default)]
    pub reader_translation_excluded_feed_ids: Vec<String>,
```

**Step 2: Add default value in Default impl**

In the `Default` impl, add after `reader_translation_auto_enabled: false` (line 199):

```rust
            reader_translation_excluded_feed_ids: vec![],
```

**Step 3: Verify Rust compilation**

Run: `cd src-tauri && cargo build --lib`
Expected: Compiles successfully

**Step 4: Regenerate TypeScript bindings**

Run: `bun run codegen:tauri`
Expected: `src/lib/bindings.ts` updated with `reader_translation_excluded_feed_ids: string[]`

**Step 5: Commit**

```bash
git add src-tauri/src/types.rs src/lib/bindings.ts
git commit -m "feat(prefs): Add reader_translation_excluded_feed_ids to AppPreferences"
```

---

### Task 2: Add excluded feed IDs to useReaderSettings hook

**Files:**
- Modify: `src/hooks/use-reader-settings.ts:66-133`

**Step 1: Add getter and setter to the return object**

After `translationAutoEnabled` (line 85), add:

```typescript
    translationExcludedFeedIds: preferences?.reader_translation_excluded_feed_ids ?? [],
```

After `setTranslationAutoEnabled` setter (line 126), add:

```typescript
    setTranslationExcludedFeedIds: (ids: string[]) =>
      updateSetting('reader_translation_excluded_feed_ids', ids),
```

**Step 2: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/use-reader-settings.ts
git commit -m "feat(hooks): Expose translationExcludedFeedIds in useReaderSettings"
```

---

### Task 3: Add feed exclusion check in EntryReading

**Files:**
- Modify: `src/components/miniflux/EntryReading.tsx:74-101` (useReaderSettings destructure)
- Modify: `src/components/miniflux/EntryReading.tsx:408-417` (auto-translate effect)

**Step 1: Destructure new field from useReaderSettings**

In the `useReaderSettings()` destructure (line 74-101), add:

```typescript
    translationExcludedFeedIds,
```

**Step 2: Compute isExcludedFeed**

After the `useReaderSettings()` call, add:

```typescript
  const isExcludedFeed = entry ? translationExcludedFeedIds.includes(entry.feed_id) : false;
```

**Step 3: Update the auto-translate effect to skip excluded feeds**

Modify the effect at lines 408-417. Change line 412 from:

```typescript
    const shouldTranslate = translationAutoEnabledRef.current;
```

to:

```typescript
    const shouldTranslate = translationAutoEnabledRef.current && !isExcludedFeedRef.current;
```

Add a ref for `isExcludedFeed` near the other refs:

```typescript
  const isExcludedFeedRef = useRef(isExcludedFeed);
  isExcludedFeedRef.current = isExcludedFeed;
```

**Step 4: Pass isExcludedFeed to EntryReadingHeader**

Add `isExcludedFeed` prop when rendering `EntryReadingHeader`:

```typescript
        isExcludedFeed={isExcludedFeed}
```

**Step 5: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: Errors about missing prop in EntryReadingHeader (expected, will fix in Task 4)

**Step 6: Commit**

```bash
git add src/components/miniflux/EntryReading.tsx
git commit -m "feat(reader): Add feed exclusion check for immersive translation"
```

---

### Task 4: Merge header popovers into unified Translation popover

**Files:**
- Modify: `src/components/miniflux/EntryReadingHeader.tsx`

This is the largest task. We merge the Globe popover (lines 302-411) and the 中文顯示 popover (lines 415-530) into one.

**Step 1: Add `isExcludedFeed` to the props interface**

In `EntryReadingHeaderProps` (line 49-82), add:

```typescript
  isExcludedFeed: boolean;
```

And destructure it in the function signature.

**Step 2: Replace the two popovers with one unified popover**

Remove the Globe popover (lines 302-411) and the 中文顯示 popover (lines 415-530). Replace with a single popover:

```tsx
<Popover>
  <Tooltip>
    <TooltipTrigger
      render={
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                toolbarButtonClass,
                'relative',
                translationControlActive &&
                  'border-border/60 bg-accent/70 text-foreground'
              )}
              aria-label={_(msg`Translation options`)}
            >
              <HugeiconsIcon icon={Globe02Icon} className="h-5 w-5" strokeWidth={2} />
              {translationControlActive && (
                <span
                  className="absolute -end-0.5 -top-0.5 size-2 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
            </Button>
          }
        />
      }
    />
    <TooltipPanel>{_(msg`Translation`)}</TooltipPanel>
  </Tooltip>
  <PopoverContent
    className="w-72 space-y-3 rounded-2xl border-border/60 bg-popover/95 p-3.5 shadow-xl"
    side="bottom"
    align="end"
  >
    <PopoverHeader>
      <PopoverTitle>{_(msg`Translation`)}</PopoverTitle>
    </PopoverHeader>

    {/* Section: Language Translation */}
    {isExcludedFeed ? (
      <div className="rounded-md border border-border/50 px-2.5 py-2">
        <p className="text-xs text-muted-foreground">
          {_(msg`Translation disabled for this feed`)}
        </p>
      </div>
    ) : (
      <>
        <div className="flex items-center justify-between rounded-md border border-border/50 px-2.5 py-2">
          <div className="space-y-0.5">
            <p className="text-xs font-medium">{_(msg`Translate now`)}</p>
          </div>
          <Switch
            checked={translationEnabled}
            onCheckedChange={(checked) => onTranslationEnabledChange(Boolean(checked))}
            aria-label={_(msg`Translate now`)}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">{_(msg`Target language`)}</p>
          <Select
            value={translationTargetLanguage ?? 'en'}
            onValueChange={(value) => onTranslationTargetLanguageChange(value)}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {translationTargetLanguageOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">{_(msg`Display mode`)}</p>
          <Select
            value={translationDisplayMode}
            onValueChange={(value) =>
              onTranslationDisplayModeChange(
                value as AppPreferences['reader_translation_display_mode']
              )
            }
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bilingual">{_(msg`Bilingual`)}</SelectItem>
              <SelectItem value="translated_only">{_(msg`Translated only`)}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {activeTranslationProvider && (
          <div
            className="flex items-center justify-between rounded-md border border-border/50 px-2.5 py-2"
            data-testid="active-translation-provider-badge"
          >
            <p className="text-xs text-muted-foreground">{_(msg`Provider`)}</p>
            <p className="text-xs font-medium">
              {getTranslationProviderLabel(activeTranslationProvider)}
            </p>
          </div>
        )}
      </>
    )}

    {/* Divider */}
    <div className="border-t border-border/40" />

    {/* Section: Chinese Display */}
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{_(msg`中文顯示`)}</p>
      <Select
        value={chineseConversionMode}
        onValueChange={(value) =>
          setChineseConversionMode(value as ChineseConversionMode)
        }
        disabled={isLoading}
      >
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {conversionOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </PopoverContent>
</Popover>
```

**Step 3: Keep `<ReaderSettings />` and the remaining display popover controls**

The remaining controls from the old 中文顯示 popover (code theme, reading theme, bionic reading, status bar) should stay in the `<ReaderSettings />` component or a separate "Reading display" popover. If `<ReaderSettings />` already contains those controls, simply keep it as-is. If the TextIcon popover was the only place for those, move code theme / reading theme / bionic reading / status bar into `<ReaderSettings />`.

Check `src/components/miniflux/ReaderSettings.tsx` to see what it already contains. The code theme, reading theme, bionic reading, and status bar controls that were in the TextIcon popover need to remain accessible - if ReaderSettings doesn't have them, they should be added there.

**Step 4: Remove unused TextIcon import if no longer needed**

If the TextIcon button is fully removed, remove its import from line 13.

**Step 5: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: No errors

**Step 6: Commit**

```bash
git add src/components/miniflux/EntryReadingHeader.tsx
git commit -m "feat(reader): Merge translation and Chinese display into unified popover"
```

---

### Task 5: Move Chinese Conversion section from AppearancePane to TranslationPane

**Files:**
- Modify: `src/components/preferences/panes/AppearancePane.tsx`
- Modify: `src/components/preferences/panes/TranslationPane.tsx`

**Step 1: Move helper types and functions to TranslationPane**

Move from AppearancePane to TranslationPane:
- `CustomRuleDraft` interface (line 30-32)
- `customRuleDraftId` variable and `nextCustomRuleDraftId()` function (lines 34-38)
- `normalizeRules()` function (lines 41-46)
- `toDraftRules()` function (lines 48-54)

**Step 2: Move state and logic to TranslationPane**

In TranslationPane, add the same state management that AppearancePane has:
- `customRulesDraft` state
- `persistedRules` memo
- `normalizedDraftRules` memo
- `hasInvalidCustomRules` memo
- `hasRuleChanges` derived value
- `useEffect` for syncing draft with persisted rules
- `updateCustomRule`, `addCustomRule`, `removeCustomRule`, `resetCustomRules`, `saveCustomRules` handlers

**Step 3: Add Chinese Conversion SettingsSection to TranslationPane**

After the existing immersive translation sections, add a new section:

```tsx
<SettingsSection title={_(msg`Chinese Conversion`)}>
  <SettingsField
    label={_(msg`Conversion Mode`)}
    description={_(msg`Convert Chinese characters between Simplified and Traditional variants.`)}
  >
    <Select
      value={preferences?.reader_chinese_conversion ?? 's2tw'}
      onValueChange={(value) => {
        if (preferences) {
          savePreferences.mutate({
            ...preferences,
            reader_chinese_conversion: value as ChineseConversionMode,
          });
        }
      }}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="off">{_(msg`Off`)}</SelectItem>
        <SelectItem value="s2hk">{_(msg`繁體中文（香港）`)}</SelectItem>
        <SelectItem value="s2tw">{_(msg`繁體中文（台灣）`)}</SelectItem>
        <SelectItem value="t2s">{_(msg`簡體中文`)}</SelectItem>
      </SelectContent>
    </Select>
  </SettingsField>

  <SettingsField
    label={_(msg`Custom Term Conversion`)}
    description={_(msg`These replacements are applied after built-in Chinese conversion in the reading panel.`)}
  >
    {/* Same custom rules UI as currently in AppearancePane */}
  </SettingsField>
</SettingsSection>
```

**Step 4: Remove Chinese Conversion section from AppearancePane**

Remove the `<SettingsSection title="Chinese Conversion">` block (lines 214-289) and all related state/functions/imports that are no longer needed.

**Step 5: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: No errors

**Step 6: Commit**

```bash
git add src/components/preferences/panes/AppearancePane.tsx src/components/preferences/panes/TranslationPane.tsx
git commit -m "refactor(prefs): Move Chinese Conversion settings from AppearancePane to TranslationPane"
```

---

### Task 6: Add Feed Exclusions section to TranslationPane

**Files:**
- Modify: `src/components/preferences/panes/TranslationPane.tsx`

**Step 1: Import useFeeds hook**

```typescript
import { useFeeds } from '@/services/miniflux/feeds';
```

**Step 2: Add Feed Exclusions SettingsSection**

After the Chinese Conversion section, add:

```tsx
<SettingsSection title={_(msg`Feed Exclusions`)}>
  <SettingsField
    label={_(msg`Excluded Feeds`)}
    description={_(msg`Feeds in this list will not be automatically translated. Chinese conversion still applies.`)}
  >
    <FeedExclusionList />
  </SettingsField>
</SettingsSection>
```

**Step 3: Implement FeedExclusionList component**

Create as a local component within TranslationPane (not a separate file):

```tsx
function FeedExclusionList() {
  const { _ } = useLingui();
  const { data: preferences } = usePreferences();
  const { mutate: savePreferences, isPending } = useSavePreferences();
  const { data: feeds } = useFeeds();
  const excludedIds = preferences?.reader_translation_excluded_feed_ids ?? [];

  const excludedFeeds = (feeds ?? []).filter((feed) => excludedIds.includes(feed.id));
  const availableFeeds = (feeds ?? []).filter((feed) => !excludedIds.includes(feed.id));

  const addFeed = (feedId: string) => {
    if (!preferences || excludedIds.includes(feedId)) return;
    savePreferences({
      ...preferences,
      reader_translation_excluded_feed_ids: [...excludedIds, feedId],
    });
  };

  const removeFeed = (feedId: string) => {
    if (!preferences) return;
    savePreferences({
      ...preferences,
      reader_translation_excluded_feed_ids: excludedIds.filter((id) => id !== feedId),
    });
  };

  return (
    <div className="space-y-2">
      {excludedFeeds.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {_(msg`No feeds excluded. All feeds will be translated when translation is enabled.`)}
        </p>
      )}

      {excludedFeeds.map((feed) => (
        <div key={feed.id} className="flex items-center justify-between rounded-md border border-border/50 px-2.5 py-2">
          <p className="text-sm truncate">{feed.title}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => removeFeed(feed.id)}
            disabled={isPending}
          >
            {_(msg`Remove`)}
          </Button>
        </div>
      ))}

      {availableFeeds.length > 0 && (
        <Combobox>
          <ComboboxInput placeholder={_(msg`Search feeds to exclude...`)} />
          <ComboboxContent>
            <ComboboxList>
              {availableFeeds.map((feed) => (
                <ComboboxItem
                  key={feed.id}
                  value={feed.id}
                  onSelect={() => addFeed(feed.id)}
                >
                  {feed.title}
                </ComboboxItem>
              ))}
              <ComboboxEmpty>{_(msg`No feeds found`)}</ComboboxEmpty>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}
    </div>
  );
}
```

Note: The Combobox component is already used in TranslationPane (imported at lines 35-41). Reuse the same pattern.

**Step 4: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/preferences/panes/TranslationPane.tsx
git commit -m "feat(prefs): Add Feed Exclusions section to TranslationPane"
```

---

### Task 7: Move ReaderSettings popover controls (code theme, reading theme, bionic, status bar)

**Files:**
- Modify: `src/components/miniflux/ReaderSettings.tsx` (if it exists and needs the controls)
- Possibly modify: `src/components/miniflux/EntryReadingHeader.tsx`

**Step 1: Verify ReaderSettings component**

Check what `src/components/miniflux/ReaderSettings.tsx` already contains. The code theme, reading theme, bionic reading, and status bar controls that were in the TextIcon/中文顯示 popover need to be accessible somewhere.

If ReaderSettings already has these controls, no changes needed - just verify.

If ReaderSettings does NOT have these, move the code theme dropdown, reading theme dropdown, bionic reading toggle, and status bar toggle into it.

**Step 2: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit (only if changes were needed)**

```bash
git add src/components/miniflux/ReaderSettings.tsx src/components/miniflux/EntryReadingHeader.tsx
git commit -m "refactor(reader): Ensure display settings remain accessible after popover merge"
```

---

### Task 8: Update tests

**Files:**
- Modify: `src/components/miniflux/ImmersiveTranslationLayer.test.tsx`
- Modify: `src/components/preferences/panes/TranslationPane.translation.test.tsx`

**Step 1: Add test for excluded feed indicator in header popover**

Test that when `isExcludedFeed=true`, the "Translation disabled for this feed" message appears and the translate toggle is hidden.

**Step 2: Add test for feed exclusion list in TranslationPane**

Test that feeds can be added and removed from the exclusion list.

**Step 3: Update existing tests if broken**

Check if any existing EntryReadingHeader tests reference the old two-popover structure and update them.

**Step 4: Run all tests**

Run: `bun run test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "test: Update tests for unified translation popover and feed exclusions"
```

---

### Task 9: Final verification

**Step 1: Run full quality checks**

Run: `bun run check:all`
Expected: All checks pass (typecheck, clippy, cargo test, cargo fmt)

**Step 2: Verify app launches**

Run: `bun run dev`
Expected: App launches, translation popover shows unified controls, Chinese conversion section appears in TranslationPane preferences

**Step 3: Manual testing checklist**

- [ ] Single Translation button in reader header (Globe icon)
- [ ] Popover has Language Translation section + divider + Chinese Display section
- [ ] Translate toggle works normally for non-excluded feeds
- [ ] "Translation disabled for this feed" shows for excluded feeds
- [ ] Chinese conversion dropdown works in unified popover
- [ ] Code theme, reading theme, bionic reading, status bar still accessible
- [ ] TranslationPane in preferences has three sections: Immersive Translation, Chinese Conversion, Feed Exclusions
- [ ] Feed exclusion list shows feeds, can add/remove via combobox
- [ ] AppearancePane no longer has Chinese Conversion section
- [ ] OpenCC conversion still works on excluded feeds (only immersive translation is blocked)
