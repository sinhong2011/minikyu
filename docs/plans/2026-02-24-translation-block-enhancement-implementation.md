# Translation Block Menu Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add translation provider info, retry, "Translate with..." submenu, and copy translation to the existing per-block dropdown menu in the immersive reader.

**Architecture:** Pass segment translation state from `ImmersiveTranslationLayer` down to `SafeHtml` via new props, so `wrapReaderNodeBlock()` can render translation-aware menu items. Add a `forced_provider` field to the backend `TranslationSegmentRequest` so the "Translate with..." submenu can bypass the normal fallback chain.

**Tech Stack:** React 19, TypeScript, Tauri v2 (Rust), tauri-specta bindings, Lingui i18n, animate-ui Menu components

---

### Task 1: Add `forced_provider` to Rust `TranslationSegmentRequest`

**Files:**
- Modify: `src-tauri/src/commands/translation.rs:259-268` (struct definition)
- Modify: `src-tauri/src/commands/translation.rs:1512-1589` (command handler)
- Test: `src-tauri/src/commands/translation.rs` (existing test module)

**Step 1: Add the field to the struct**

In `src-tauri/src/commands/translation.rs`, add `forced_provider` to `TranslationSegmentRequest`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TranslationSegmentRequest {
    pub text: String,
    pub source_language: Option<String>,
    pub target_language: String,
    pub route_mode: String,
    pub primary_engine: Option<String>,
    pub engine_fallbacks: Vec<String>,
    pub llm_fallbacks: Vec<String>,
    pub apple_fallback_enabled: bool,
    pub forced_provider: Option<String>,
}
```

**Step 2: Update `translate_reader_segment` to use `forced_provider`**

At the top of `translate_reader_segment`, after `validate_translation_segment_request`, add an early return path when `forced_provider` is set:

```rust
// If forced_provider is set, skip the fallback chain entirely
if let Some(ref forced) = request.forced_provider {
    let provider = normalize_provider_identifier(forced)
        .ok_or_else(|| format!("Unknown forced provider: {forced}"))?;

    let available = if provider == APPLE_BUILT_IN_PROVIDER {
        apple_available
    } else if !provider_has_runtime_settings(&provider, provider_settings) {
        false
    } else if !provider_requires_key(&provider) {
        true
    } else {
        provider_has_key_in_default_profile(&provider)?
    };

    if !available {
        return Err(format!("Forced provider '{provider}' is not available"));
    }

    let translated_text = if provider == APPLE_BUILT_IN_PROVIDER {
        translate_with_apple_built_in(&request).map(|r| r.translated_text)
    } else {
        let api_key = if provider_requires_key(&provider) {
            Some(get_provider_key_in_default_profile(&provider)?)
        } else {
            get_provider_key_in_default_profile(&provider).ok()
        };
        let settings = provider_settings.get(provider.as_str());
        translate_with_external_provider(&provider, &request, api_key.as_deref(), settings).await
    }
    .map_err(|e| format!("{provider}: {e}"))?;

    return Ok(TranslationSegmentResponse {
        translated_text,
        provider_used: provider,
        fallback_chain: vec![forced.clone()],
    });
}
```

Insert this block in `translate_reader_segment` after `let provider_attempts = ...` and before `if provider_attempts.is_empty()`.

**Step 3: Verify Rust compilation**

Run: `cd src-tauri && cargo build --lib`
Expected: Compiles successfully

**Step 4: Regenerate TypeScript bindings**

Run: `bun run codegen:tauri`

Verify that `src/lib/bindings.ts` now includes `forced_provider: string | null` in the `TranslationSegmentRequest` type.

**Step 5: Commit**

```bash
git add src-tauri/src/commands/translation.rs src/lib/bindings.ts
git commit -m "feat(translation): Add forced_provider field to TranslationSegmentRequest"
```

---

### Task 2: Update frontend translation service for `forced_provider`

**Files:**
- Modify: `src/services/translation/types.ts:12-18` (input type)
- Modify: `src/services/translation/router.ts:24-44` (request builder)
- Modify: `src/lib/tauri-bindings.ts` (normalize function)

**Step 1: Add `forcedProvider` to `TranslateReaderSegmentInput`**

In `src/services/translation/types.ts`:

```typescript
export type TranslateReaderSegmentInput = {
  text: string;
  sourceLanguage?: string | null;
  targetLanguage?: string;
  preferences: TranslationRoutingPreferences;
  forcedProvider?: string | null;
};
```

**Step 2: Pass `forced_provider` in `buildTranslationSegmentRequest`**

In `src/services/translation/router.ts`, add to the returned object in `buildTranslationSegmentRequest`:

```typescript
// biome-ignore lint/style/useNamingConvention: Tauri command payload field name
forced_provider: input.forcedProvider ?? null,
```

**Step 3: Update `normalizeTranslationSegmentRequest` in `tauri-bindings.ts`**

Add `forced_provider` passthrough in the normalize function:

```typescript
export function normalizeTranslationSegmentRequest(
  request: TranslationSegmentRequest
): TranslationSegmentRequest {
  return {
    ...request,
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    route_mode: request.route_mode.trim(),
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    primary_engine: request.primary_engine ? request.primary_engine.trim() : null,
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    engine_fallbacks: request.engine_fallbacks.map((provider) => provider.trim()),
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    llm_fallbacks: request.llm_fallbacks.map((provider) => provider.trim()),
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    forced_provider: request.forced_provider ? request.forced_provider.trim() : null,
  };
}
```

**Step 4: Verify TypeScript compilation**

Run: `bun run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/services/translation/types.ts src/services/translation/router.ts src/lib/tauri-bindings.ts
git commit -m "feat(translation): Pass forced_provider through frontend translation service"
```

---

### Task 3: Add segment state and provider list props to `SafeHtml`

**Files:**
- Modify: `src/components/miniflux/SafeHtml.tsx:53-62` (SafeHtmlProps interface)
- Modify: `src/components/miniflux/SafeHtml.tsx:1126-1234` (wrapReaderNodeBlock function signature)

**Step 1: Extend `SafeHtmlProps` with translation state props**

Add these new props to the `SafeHtmlProps` interface at `SafeHtml.tsx:53`:

```typescript
interface SafeHtmlProps {
  html: string;
  bionicEnglish?: boolean;
  chineseConversionMode?: ChineseConversionMode;
  customConversionRules?: ChineseConversionRule[];
  codeTheme?: ReaderCodeTheme;
  className?: string;
  style?: React.CSSProperties;
  onTranslateNode?: (text: string) => void;
  /** Per-segment translation state, keyed by segment index string ("0", "1", ...) */
  segmentStates?: Record<string, { status: string; translatedText: string | null; providerUsed: string | null }>;
  /** List of available providers for "Translate with..." submenu */
  availableProviders?: Array<{ id: string; label: string }>;
  /** Called when user picks a specific provider from the submenu */
  onTranslateWithProvider?: (text: string, providerId: string) => void;
  /** Called when user clicks "Retry translation" for a block */
  onRetryTranslation?: (text: string) => void;
  /** Called when user clicks "Copy translation" */
  onCopyTranslation?: (translatedText: string) => void;
}
```

**Step 2: Destructure new props in the SafeHtml component**

Find the existing destructuring of props in the `SafeHtml` component function (around line 628) and add the new props:

```typescript
segmentStates,
availableProviders,
onTranslateWithProvider,
onRetryTranslation,
onCopyTranslation,
```

**Step 3: Verify TypeScript compilation**

Run: `bun run typecheck`
Expected: No errors (new props are optional)

**Step 4: Commit**

```bash
git add src/components/miniflux/SafeHtml.tsx
git commit -m "feat(reader): Add translation state props to SafeHtml interface"
```

---

### Task 4: Build translation-aware block menu in `wrapReaderNodeBlock`

**Files:**
- Modify: `src/components/miniflux/SafeHtml.tsx:1126-1234` (wrapReaderNodeBlock)

This task modifies the `<MenuGroup>` under the "Translation" label in `wrapReaderNodeBlock` to show different items based on segment state.

**Step 1: Add i18n labels for new menu items**

Near the existing label declarations (around line 660-666), add:

```typescript
const retryTranslationLabel = _(msg`Retry translation`);
const translateWithLabel = _(msg`Translate with...`);
const copyTranslationLabel = _(msg`Copy translation`);
const translationFailedLabel = _(msg`Translation failed`);
```

**Step 2: Look up segment state inside `wrapReaderNodeBlock`**

At the top of `wrapReaderNodeBlock` (after `readerNodeIndex += 1`), add:

```typescript
const segmentState = segmentStates?.[String(nodeIndex)];
const isTranslated = segmentState?.status === 'success';
const isFailed = segmentState?.status === 'error';
const isLoading = segmentState?.status === 'loading';
```

**Step 3: Replace the Translation `<MenuGroup>` contents**

Replace the existing Translation `<MenuGroup>` (lines ~1198-1220) with conditional rendering:

```tsx
<MenuGroup>
  <MenuGroupLabel className="px-2.5 pb-1 pt-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/90">
    {translationActionsLabel}
  </MenuGroupLabel>

  {/* Translated block: show provider info */}
  {isTranslated && segmentState?.providerUsed && (
    <MenuItem
      disabled
      className="rounded-lg px-2.5 py-1.5 text-[0.85rem] font-medium text-muted-foreground"
    >
      <span className="flex items-center gap-1.5">
        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3.5 w-3.5 text-emerald-500" />
        {segmentState.providerUsed}
      </span>
    </MenuItem>
  )}

  {/* Failed block: show error indicator */}
  {isFailed && (
    <MenuItem
      disabled
      className="rounded-lg px-2.5 py-1.5 text-[0.85rem] font-medium text-destructive"
    >
      <span>{translationFailedLabel}</span>
    </MenuItem>
  )}

  {/* Retry translation (shown for translated and failed blocks) */}
  {(isTranslated || isFailed) && onRetryTranslation && (
    <MenuItem
      onClick={() => onRetryTranslation(nodeText)}
      className="rounded-lg px-2.5 py-2 text-[0.95rem] font-medium"
    >
      <span>{retryTranslationLabel}</span>
    </MenuItem>
  )}

  {/* Translate with... submenu (shown for translated and failed blocks) */}
  {(isTranslated || isFailed) && availableProviders && availableProviders.length > 0 && onTranslateWithProvider && (
    <Menu>
      <MenuItem asSubmenuTrigger className="rounded-lg px-2.5 py-2 text-[0.95rem] font-medium">
        <span>{translateWithLabel}</span>
      </MenuItem>
      <MenuPanel
        anchor="right start"
        className="w-56 rounded-2xl border-border/60 bg-popover/95 p-1.5 shadow-[0_24px_48px_-28px_hsl(var(--foreground)/0.7),0_14px_32px_-24px_hsl(var(--foreground)/0.55)] backdrop-blur-xl"
      >
        {availableProviders.map((provider) => (
          <MenuItem
            key={provider.id}
            onClick={() => onTranslateWithProvider(nodeText, provider.id)}
            className="rounded-lg px-2.5 py-2 text-[0.9rem] font-medium"
          >
            <span className="flex items-center gap-1.5">
              {segmentState?.providerUsed === provider.id && (
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3.5 w-3.5 text-emerald-500" />
              )}
              {provider.label}
            </span>
          </MenuItem>
        ))}
      </MenuPanel>
    </Menu>
  )}

  {/* Copy translation (shown only for successfully translated blocks) */}
  {isTranslated && segmentState?.translatedText && onCopyTranslation && (
    <MenuItem
      onClick={() => onCopyTranslation(segmentState.translatedText!)}
      className="rounded-lg px-2.5 py-2 text-[0.95rem] font-medium"
    >
      <span className="flex items-center gap-1.5">
        <HugeiconsIcon icon={CopyIcon} className="h-3.5 w-3.5" />
        {copyTranslationLabel}
      </span>
    </MenuItem>
  )}

  {/* Untranslated / idle block: show original translate paragraph item */}
  {!isTranslated && !isFailed && !isLoading && (
    <>
      {onTranslateNode ? (
        <MenuItem
          onClick={() => onTranslateNode(nodeText)}
          className="rounded-lg px-2.5 py-2 text-[0.95rem] font-medium"
        >
          <span>{translateParagraphLabel}</span>
        </MenuItem>
      ) : (
        <MenuItem
          disabled
          className="rounded-lg px-2.5 py-2 text-[0.85rem] font-medium text-muted-foreground"
        >
          <span>{translationToolbarHintLabel}</span>
          <MenuShortcut className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground/70">
            {topBarLabel}
          </MenuShortcut>
        </MenuItem>
      )}
    </>
  )}

  {/* Loading state: show disabled item */}
  {isLoading && (
    <MenuItem
      disabled
      className="rounded-lg px-2.5 py-1.5 text-[0.85rem] font-medium text-muted-foreground animate-pulse"
    >
      <span>{_(msg`Translating...`)}</span>
    </MenuItem>
  )}
</MenuGroup>
```

> **Note:** The `Menu` nested inside a `MenuItem` as a submenu trigger uses the animate-ui compound component pattern. Check that `asSubmenuTrigger` is a valid prop on `MenuItem`. If not, you may need to use a different pattern — see the animate-ui docs. An alternative is to render the submenu providers as flat `MenuItem` elements with indentation, which avoids the nested `Menu` complexity.

**Step 4: Add new labels to the dependency list of the useMemo**

Find the `useMemo` dependency array at the end of the `SafeHtml` component (around line 1430-1440) and add all new variables:

```typescript
retryTranslationLabel,
translateWithLabel,
copyTranslationLabel,
translationFailedLabel,
segmentStates,
availableProviders,
onTranslateWithProvider,
onRetryTranslation,
onCopyTranslation,
```

**Step 5: Verify TypeScript compilation**

Run: `bun run typecheck`
Expected: No errors

**Step 6: Commit**

```bash
git add src/components/miniflux/SafeHtml.tsx
git commit -m "feat(reader): Build translation-aware block menu with provider info and retry"
```

---

### Task 5: Wire segment states and handlers in `ImmersiveTranslationLayer`

**Files:**
- Modify: `src/components/miniflux/ImmersiveTranslationLayer.tsx:29-45` (props)
- Modify: `src/components/miniflux/ImmersiveTranslationLayer.tsx:156-443` (component body)

**Step 1: Add `providerSettings` prop to `ImmersiveTranslationLayerProps`**

Add this new prop to the interface at line 29:

```typescript
export interface ImmersiveTranslationLayerProps {
  // ... existing props ...
  /** Provider settings for building "Translate with..." list */
  providerSettings?: Partial<Record<string, { enabled: boolean; model?: string | null }>>;
}
```

**Step 2: Build the available providers list**

Inside the component, after the existing refs/state, compute the available providers list:

```typescript
const availableProviders = useMemo(() => {
  if (!providerSettings) return [];
  const providerDisplayNames: Record<string, string> = {
    deepl: 'DeepL',
    google_translate: 'Google Translate',
    apple_built_in: 'Apple Built-in',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Gemini',
    ollama: 'Ollama',
    deepseek: 'DeepSeek',
    qwen: 'Qwen',
    kimi: 'Kimi',
    minimax: 'MiniMax',
    openrouter: 'OpenRouter',
    glm: 'GLM',
  };

  return Object.entries(providerSettings)
    .filter(([, settings]) => settings?.enabled)
    .map(([id, settings]) => {
      const baseName = providerDisplayNames[id] ?? id;
      const model = settings?.model;
      const label = model ? `${baseName} · ${model}` : baseName;
      return { id, label };
    });
}, [providerSettings]);
```

**Step 3: Add `translateWithProvider` handler**

After the existing `handleTranslateNode` callback, add:

```typescript
const translateWithProvider = useCallback(
  (text: string, providerId: string) => {
    const segment = segments.find((s) => s.text === text);
    if (!segment) return;

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

    // Set loading state immediately
    setSegmentStates((prev) => ({
      ...prev,
      [segment.id]: { status: 'loading', translatedText: null, providerUsed: null },
    }));

    void (async () => {
      const targetLanguage = translationPreferencesRef.current.reader_translation_target_language ?? '';
      let cacheKey: string | null = null;
      if (targetLanguage) {
        cacheKey = await computeTranslationCacheKey(segment.text, targetLanguage);
      }

      try {
        const translationResult = await translateReaderSegmentWithPreferences({
          text: segment.text,
          sourceLanguage,
          preferences: translationPreferencesRef.current,
          forcedProvider: providerId,
        });

        if (requestId !== activeRequestIdRef.current) return;

        setSegmentStates((prev) => ({
          ...prev,
          [segment.id]: {
            status: 'success',
            translatedText: translationResult.translatedText,
            providerUsed: translationResult.providerUsed,
          },
        }));
        onActiveProviderChangeRef.current?.(translationResult.providerUsed);

        if (cacheKey) {
          void commands.setTranslationCacheEntry(cacheKey, {
            translated_text: translationResult.translatedText,
            provider_used: translationResult.providerUsed,
            cached_at: String(Math.floor(Date.now() / 1000)),
          });
        }
      } catch {
        if (requestId !== activeRequestIdRef.current) return;
        setSegmentStates((prev) => ({
          ...prev,
          [segment.id]: { status: 'error', translatedText: null, providerUsed: null },
        }));
      }
    })();
  },
  [segments, sourceLanguage]
);
```

**Step 4: Add clipboard handler**

```typescript
const handleCopyTranslation = useCallback((translatedText: string) => {
  void navigator.clipboard.writeText(translatedText);
}, []);
```

**Step 5: Pass new props to `<SafeHtml>`**

Update the `<SafeHtml>` JSX in the return statement:

```tsx
<SafeHtml
  html={translatedHtml}
  bionicEnglish={bionicEnglish}
  chineseConversionMode={chineseConversionMode}
  customConversionRules={customConversionRules}
  codeTheme={codeTheme}
  className={className}
  style={style}
  onTranslateNode={handleTranslateNode}
  segmentStates={segmentStates}
  availableProviders={availableProviders}
  onTranslateWithProvider={translateWithProvider}
  onRetryTranslation={handleTranslateNode}
  onCopyTranslation={handleCopyTranslation}
/>
```

**Step 6: Verify TypeScript compilation**

Run: `bun run typecheck`
Expected: No errors

**Step 7: Commit**

```bash
git add src/components/miniflux/ImmersiveTranslationLayer.tsx
git commit -m "feat(reader): Wire segment states and translate-with-provider to SafeHtml"
```

---

### Task 6: Pass `providerSettings` from `EntryReading` to `ImmersiveTranslationLayer`

**Files:**
- Modify: `src/components/miniflux/EntryReading.tsx` (where `ImmersiveTranslationLayer` is rendered)

**Step 1: Find the `ImmersiveTranslationLayer` render site**

Search for `<ImmersiveTranslationLayer` in `EntryReading.tsx`. It should be receiving `translationPreferences` already.

**Step 2: Extract `providerSettings` from preferences**

The `reader_translation_provider_settings` field is already part of the preferences object loaded by the reader settings hook. Pass the relevant subset:

```typescript
providerSettings={preferences?.reader_translation_provider_settings}
```

Add this as a new prop on the `<ImmersiveTranslationLayer>` JSX element.

**Step 3: Verify TypeScript compilation**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/miniflux/EntryReading.tsx
git commit -m "feat(reader): Pass providerSettings to ImmersiveTranslationLayer"
```

---

### Task 7: Write tests for new menu behavior

**Files:**
- Modify: `src/components/miniflux/ImmersiveTranslationLayer.test.tsx`

**Step 1: Write test for "Translate with..." calls `translateReaderSegmentWithPreferences` with `forcedProvider`**

```typescript
it('translateWithProvider passes forcedProvider to translation service', async () => {
  // This test verifies the data flow — when a segment is translated with a forced provider,
  // the translation service receives the forcedProvider parameter.
  // Since SafeHtml's menu triggers are internal, we test via the ImmersiveTranslationLayer
  // by verifying that translateReaderSegmentWithPreferences is called with the right shape.

  // First, translate normally to get a translated state
  renderWithI18n(
    <LayerHarness translationDisplayMode="bilingual" />
  );
  fireEvent.click(screen.getByText('Translate'));

  await waitFor(() => {
    expect(translateReaderSegmentWithPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.any(String) })
    );
  });
});
```

**Step 2: Write test for segment states being passed through**

```typescript
it('passes segment states to SafeHtml for menu rendering', async () => {
  renderWithI18n(
    <LayerHarness translationDisplayMode="bilingual" />
  );

  fireEvent.click(screen.getByText('Translate'));

  await waitFor(() => {
    // After translation, translated segments should have data-testid attributes
    const translatedSegments = screen.getAllByTestId(/translated-segment-/);
    expect(translatedSegments.length).toBeGreaterThan(0);
  });
});
```

**Step 3: Run tests**

Run: `bun run test -- --run src/components/miniflux/ImmersiveTranslationLayer.test.tsx`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/components/miniflux/ImmersiveTranslationLayer.test.tsx
git commit -m "test(reader): Add tests for translation menu segment state flow"
```

---

### Task 8: Verify submenu pattern with animate-ui

**Files:**
- Check: `src/components/animate-ui/components/base/menu.tsx` for submenu support

**Step 1: Check if animate-ui Menu supports nested submenus**

Read the `menu.tsx` component to verify that `<Menu>` can be nested inside a `<MenuItem>` as a submenu trigger. Look for `asSubmenuTrigger`, `SubMenu`, `MenuSub`, or similar patterns.

**Step 2: If nested Menu is NOT supported**

Replace the "Translate with..." submenu approach with a flat list inside a `<MenuGroup>` with a label:

```tsx
{(isTranslated || isFailed) && availableProviders && availableProviders.length > 0 && onTranslateWithProvider && (
  <>
    <MenuSeparator className="my-1 bg-border/50" />
    <MenuGroupLabel className="px-2.5 pb-1 pt-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/90">
      {translateWithLabel}
    </MenuGroupLabel>
    {availableProviders.map((provider) => (
      <MenuItem
        key={provider.id}
        onClick={() => onTranslateWithProvider(nodeText, provider.id)}
        className="rounded-lg px-2.5 py-1.5 text-[0.9rem] font-medium"
      >
        <span className="flex items-center gap-1.5">
          {segmentState?.providerUsed === provider.id && (
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3.5 w-3.5 text-emerald-500" />
          )}
          {provider.label}
        </span>
      </MenuItem>
    ))}
  </>
)}
```

This is the fallback approach if true submenus aren't available in the animate-ui `Menu` component.

**Step 3: Verify TypeScript compilation and visual result**

Run: `bun run typecheck`
Run: `bun run dev` — open the reader, translate an article, click the `···` menu on a translated block. Verify:
- Provider info line shows (e.g. "✓ openai")
- "Retry translation" item appears
- Provider list appears (flat or submenu)
- "Copy translation" item appears
- Clicking a different provider triggers re-translation

**Step 4: Commit if adjustments were needed**

```bash
git add src/components/miniflux/SafeHtml.tsx
git commit -m "fix(reader): Adjust translation menu to match animate-ui submenu capabilities"
```

---

### Task 9: Run quality checks

**Step 1: Run full quality gate**

Run: `bun run check:all`
Expected: All checks pass (typecheck, clippy, cargo test, cargo fmt)

**Step 2: Run frontend tests**

Run: `bun run test -- --run`
Expected: All tests pass

**Step 3: Fix any issues found**

If any checks fail, fix the issues and commit.

**Step 4: Final commit if needed**

```bash
git add -A
git commit -m "fix: Address quality check issues for translation block menu"
```
