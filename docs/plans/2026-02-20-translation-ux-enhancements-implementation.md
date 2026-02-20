# Translation UX Enhancements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship seven translation UX improvements: shimmer on node card, appear animation, persistent cache, per-node translate via ⋮ menu, selection translate, graceful entry-switch, short-paragraph skip, and a circular progress ring.

**Architecture:** Rust side adds a JSON file cache for translations (keyed by SHA-256 of text + target language, computed with Web Crypto API on the JS side). `ImmersiveTranslationLayer` integrates the cache into `translateSegment`, removes the early non-translation return path so per-node translate works even when global translate is off, and renders a `TranslationProgressRing`. `SafeHtml` gains an `onTranslateNode` prop to enable the already-present (but disabled) Translation menu item. `ReaderSelectionTranslatePopover` (already complete) is wired into `EntryReading`.

**Tech Stack:** Rust + Tauri v2, tauri-specta, Web Crypto API (SHA-256, built into WebView), framer-motion (already installed), Vitest, Tailwind v4

---

### Task 1: Translation cache — Rust types + commands

**Files:**
- Modify: `src-tauri/src/types.rs`
- Create: `src-tauri/src/commands/translation_cache.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/bindings.rs`

**Step 1: Add `TranslationCacheEntry` to `types.rs`**

Find the last struct before the `#[cfg(test)]` block and add after it:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TranslationCacheEntry {
    pub translated_text: String,
    pub provider_used: String,
    pub cached_at: i64,
}
```

**Step 2: Write failing tests for the cache helpers**

Create `src-tauri/src/commands/translation_cache.rs` with the test module first:

```rust
use crate::types::TranslationCacheEntry;
use std::collections::HashMap;
use std::fs;
use tauri::Manager;

fn get_cache_file_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    Ok(data_dir.join("translation-cache.json"))
}

fn read_cache_file(path: &std::path::Path) -> HashMap<String, TranslationCacheEntry> {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_cache_file(
    path: &std::path::Path,
    cache: &HashMap<String, TranslationCacheEntry>,
) -> Result<(), String> {
    let json = serde_json::to_string_pretty(cache)
        .map_err(|e| format!("Failed to serialize cache: {e}"))?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create cache dir: {e}"))?;
    }
    fs::write(path, json).map_err(|e| format!("Failed to write cache file: {e}"))
}

#[tauri::command]
#[specta::specta]
pub fn get_translation_cache_entry(
    app: tauri::AppHandle,
    key: String,
) -> Result<Option<TranslationCacheEntry>, String> {
    let path = get_cache_file_path(&app)?;
    let cache = read_cache_file(&path);
    Ok(cache.get(&key).cloned())
}

#[tauri::command]
#[specta::specta]
pub fn set_translation_cache_entry(
    app: tauri::AppHandle,
    key: String,
    entry: TranslationCacheEntry,
) -> Result<(), String> {
    let path = get_cache_file_path(&app)?;
    let mut cache = read_cache_file(&path);
    cache.insert(key, entry);
    write_cache_file(&path, &cache)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_cache_file_returns_empty_for_nonexistent_path() {
        let path = std::path::PathBuf::from("/nonexistent/__translation_cache_test.json");
        let result = read_cache_file(&path);
        assert!(result.is_empty());
    }

    #[test]
    fn translation_cache_entry_serializes_and_deserializes() {
        let entry = TranslationCacheEntry {
            translated_text: "你好世界".to_string(),
            provider_used: "openai".to_string(),
            cached_at: 1_700_000_000,
        };
        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: TranslationCacheEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.translated_text, "你好世界");
        assert_eq!(deserialized.provider_used, "openai");
        assert_eq!(deserialized.cached_at, 1_700_000_000);
    }

    #[test]
    fn write_and_read_cache_roundtrip() {
        let path = std::env::temp_dir().join("__test_translation_cache_roundtrip.json");
        let mut cache = HashMap::new();
        cache.insert(
            "zh-TW:abc123".to_string(),
            TranslationCacheEntry {
                translated_text: "你好".to_string(),
                provider_used: "openai".to_string(),
                cached_at: 1_700_000_000,
            },
        );
        write_cache_file(&path, &cache).unwrap();
        let read_back = read_cache_file(&path);
        let _ = std::fs::remove_file(&path);

        assert_eq!(read_back.len(), 1);
        let entry = read_back.get("zh-TW:abc123").unwrap();
        assert_eq!(entry.translated_text, "你好");
    }
}
```

**Step 3: Register the module and commands**

In `src-tauri/src/commands/mod.rs`, add:
```rust
pub mod translation_cache;
```

In `src-tauri/src/bindings.rs`, add to the imports:
```rust
use crate::commands::{
    ..., translation_cache,
};
```

Add to `collect_commands![]`:
```rust
translation_cache::get_translation_cache_entry,
translation_cache::set_translation_cache_entry,
```

**Step 4: Run the tests**

```bash
cd src-tauri && cargo test translation_cache 2>&1 | tail -20
```

Expected: 3 tests pass.

**Step 5: Full Rust build check**

```bash
cargo build --lib 2>&1 | tail -10
```

Expected: no errors.

**Step 6: Commit**

```bash
git add src-tauri/src/types.rs src-tauri/src/commands/translation_cache.rs src-tauri/src/commands/mod.rs src-tauri/src/bindings.rs
git commit -m "feat(tauri): Add translation cache commands"
```

---

### Task 2: Regenerate TypeScript bindings

**Files:**
- Auto-generated: `src/lib/bindings.ts`

**Step 1: Regenerate**

```bash
bun run rust:bindings 2>&1
```

Expected: exits 0.

**Step 2: Verify new commands appear**

```bash
grep -n "translation_cache\|TranslationCacheEntry" src/lib/bindings.ts
```

Expected: `getTranslationCacheEntry`, `setTranslationCacheEntry`, `TranslationCacheEntry` found.

**Step 3: Commit alongside the animation CSS file from Task 3**

Do NOT commit `bindings.ts` alone — the Biome pre-commit hook fails when only generated files are staged. Stage `bindings.ts` together with `src/styles/animation.css` in Task 3's commit below.

---

### Task 3: CSS animations — shimmer on node card + appear animation

**Files:**
- Modify: `src/styles/animation.css`
- Modify: `src/components/miniflux/ImmersiveTranslationLayer.tsx`

**Step 1: Update `animation.css`**

Replace the existing `.reader-translation-loading` block (around line 320–330) with the new node-card shimmer, and add the appear animation:

```css
/* Replace the old .reader-translation-loading rule */
.reader-node-block:has([data-translation-loading]) {
  border-radius: 12px;
  animation: translation-loading-shimmer 2.4s ease-in-out infinite;
}

/* Add appear animation for newly inserted bilingual translations */
@keyframes translation-appear {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reader-translation-block {
  animation: translation-appear 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* Add to the @media (prefers-reduced-motion) block — remove the old .reader-translation-loading line and add: */
/* Inside the existing @media (prefers-reduced-motion: reduce) block: */
.reader-node-block:has([data-translation-loading]) {
  animation: none;
  outline: 1.5px solid oklch(65% 0.18 264 / 0.5);
}
.reader-translation-block {
  animation: none;
}
```

**Step 2: Update `ImmersiveTranslationLayer.tsx` — use attribute instead of class**

In `buildTranslatedHtml`, find:
```typescript
if (state.status === 'loading') {
  paragraphNode.classList.add('reader-translation-loading');
}
```

Replace with:
```typescript
if (state.status === 'loading') {
  paragraphNode.setAttribute('data-translation-loading', 'true');
} else {
  paragraphNode.removeAttribute('data-translation-loading');
}
```

**Step 3: TypeScript check**

```bash
bun run typecheck 2>&1 | tail -5
```

Expected: no errors.

**Step 4: Commit bindings + animation together**

```bash
git add src/lib/bindings.ts src/styles/animation.css src/components/miniflux/ImmersiveTranslationLayer.tsx
git commit -m "feat(reader): Move translation shimmer to node card level and add appear animation"
```

---

### Task 4: Cache integration + early-exit removal + partial flush

**Files:**
- Modify: `src/components/miniflux/ImmersiveTranslationLayer.tsx`
- Modify: `src/components/miniflux/ImmersiveTranslationLayer.test.tsx`

**Step 1: Read `ImmersiveTranslationLayer.test.tsx` to understand mock structure**

Note how `commands.translateReaderSegment` is mocked — you'll need to mock `commands.getTranslationCacheEntry` and `commands.setTranslationCacheEntry` the same way.

**Step 2: Write failing tests**

In `ImmersiveTranslationLayer.test.tsx`, add a `describe('translation cache')` block:

```typescript
describe('translation cache', () => {
  it('uses cached translation without calling translateReaderSegment', async () => {
    const translateMock = vi.fn();
    const getCacheMock = vi.fn().mockResolvedValue({
      status: 'ok',
      data: { translated_text: 'Cached result', provider_used: 'openai', cached_at: 0 },
    });
    const setCacheMock = vi.fn().mockResolvedValue({ status: 'ok', data: null });

    vi.mocked(commands.translateReaderSegment).mockImplementation(translateMock);
    vi.mocked(commands.getTranslationCacheEntry).mockImplementation(getCacheMock);
    vi.mocked(commands.setTranslationCacheEntry).mockImplementation(setCacheMock);

    // Render with translationEnabled + a trigger token
    // Verify translateMock was NOT called
    // Verify the cached text appears in output
    // ... (follow existing test patterns for renderHook or render)
  });

  it('writes to cache after successful live translation', async () => {
    const setCacheMock = vi.fn().mockResolvedValue({ status: 'ok', data: null });
    vi.mocked(commands.getTranslationCacheEntry).mockResolvedValue({ status: 'ok', data: null });
    vi.mocked(commands.setTranslationCacheEntry).mockImplementation(setCacheMock);
    // Trigger translation, verify setCacheMock was called with the result
  });
});
```

Run to confirm they fail:
```bash
bun run test src/components/miniflux/ImmersiveTranslationLayer.test.tsx 2>&1 | tail -20
```

**Step 3: Add cache key helper to `ImmersiveTranslationLayer.tsx`**

Add this function near the top of the file (outside the component):

```typescript
async function computeTranslationCacheKey(
  text: string,
  targetLanguage: string
): Promise<string> {
  const data = new TextEncoder().encode(text.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${targetLanguage}:${hashHex}`;
}
```

**Step 4: Integrate cache into `translateSegment`**

Add this import at the top:
```typescript
import { commands } from '@/lib/tauri-bindings';
```
(check if already imported)

Modify the `translateSegment` callback. The `targetLanguage` comes from `translationPreferencesValue.reader_translation_target_language ?? ''`. Full new body:

```typescript
const translateSegment = useCallback(
  async (
    segment: TranslationSegment,
    requestId: number,
    sourceLanguageValue: string | null,
    translationPreferencesValue: TranslationRoutingPreferences
  ) => {
    // Early exit before network call if request is already stale
    if (requestId !== activeRequestIdRef.current) {
      return;
    }

    const targetLanguage = translationPreferencesValue.reader_translation_target_language ?? '';

    // Check cache first (skip shimmer if cache hit)
    let cacheKey: string | null = null;
    if (targetLanguage) {
      cacheKey = await computeTranslationCacheKey(segment.text, targetLanguage);
      const cacheResult = await commands.getTranslationCacheEntry({ key: cacheKey });
      if (cacheResult.status === 'ok' && cacheResult.data) {
        if (requestId !== activeRequestIdRef.current) return;
        setSegmentStates((prev) => ({
          ...prev,
          [segment.id]: {
            status: 'success',
            translatedText: cacheResult.data.translated_text,
            providerUsed: cacheResult.data.provider_used,
          },
        }));
        onActiveProviderChange?.(cacheResult.data.provider_used);
        return;
      }
    }

    // No cache hit — show shimmer and call API
    setSegmentStates((prev) => ({
      ...prev,
      [segment.id]: { status: 'loading', translatedText: null, providerUsed: null },
    }));

    try {
      const translationResult = await translateReaderSegmentWithPreferences({
        text: segment.text,
        sourceLanguage: sourceLanguageValue,
        preferences: translationPreferencesValue,
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
      onActiveProviderChange?.(translationResult.providerUsed);

      // Write to cache
      if (cacheKey) {
        void commands.setTranslationCacheEntry({
          key: cacheKey,
          entry: {
            // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
            translated_text: translationResult.translatedText,
            // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
            provider_used: translationResult.providerUsed,
            // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
            cached_at: Math.floor(Date.now() / 1000),
          },
        });
      }
    } catch {
      if (requestId !== activeRequestIdRef.current) return;
      setSegmentStates((prev) => ({
        ...prev,
        [segment.id]: { status: 'error', translatedText: null, providerUsed: null },
      }));
    }
  },
  [onActiveProviderChange]
);
```

**Step 5: Add `segmentStatesRef` for flush-on-cleanup**

After the `segmentStates` state declaration, add:
```typescript
const segmentStatesRef = useRef(segmentStates);
segmentStatesRef.current = segmentStates;
```

**Step 6: Add flush to cache in entry-change effect**

Modify the `useEffect([entryId])` to flush before resetting:

```typescript
useEffect(() => {
  return () => {
    // Flush any completed translations to cache on cleanup
    const statesToFlush = segmentStatesRef.current;
    const prefsValue = translationPreferencesRef?.current; // add this ref below
    if (prefsValue) {
      for (const [segmentId, state] of Object.entries(statesToFlush)) {
        if (state.status !== 'success' || !state.translatedText) continue;
        const segment = segments.find((s) => s.id === segmentId);
        if (!segment) continue;
        const targetLanguage = prefsValue.reader_translation_target_language ?? '';
        if (!targetLanguage) continue;
        void (async () => {
          const key = await computeTranslationCacheKey(segment.text, targetLanguage);
          void commands.setTranslationCacheEntry({
            key,
            entry: {
              // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
              translated_text: state.translatedText!,
              // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
              provider_used: state.providerUsed ?? '',
              // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
              cached_at: Math.floor(Date.now() / 1000),
            },
          });
        })();
      }
    }
  };
}, [segments, entryId]); // separate cleanup effect
```

Also add `translationPreferencesRef` near other refs:
```typescript
const translationPreferencesRef = useRef(translationPreferences);
translationPreferencesRef.current = translationPreferences;
```

**Step 7: Remove the early return for `!translationEnabled`**

The current code has:
```typescript
if (!translationEnabled) {
  return (
    <SafeHtml html={html} ... />
  );
}
```

Delete this early return. The component will always go through the translation-aware render path. When `translationEnabled = false` and no segments have been translated, `buildTranslatedHtml` returns the same HTML as input — no visual difference.

The `buildTranslatedHtml` and `failedSegments` calls should be present in all cases (move them before the early return's location).

**Step 8: Run tests**

```bash
bun run test src/components/miniflux/ImmersiveTranslationLayer.test.tsx 2>&1 | tail -20
```

Expected: all tests pass including the new cache tests.

**Step 9: TypeScript check**

```bash
bun run typecheck 2>&1 | tail -5
```

**Step 10: Commit**

```bash
git add src/components/miniflux/ImmersiveTranslationLayer.tsx src/components/miniflux/ImmersiveTranslationLayer.test.tsx
git commit -m "feat(reader): Integrate persistent translation cache and remove early-exit render path"
```

---

### Task 5: Per-node translate via ⋮ menu in SafeHtml

**Files:**
- Modify: `src/components/miniflux/SafeHtml.tsx`
- Modify: `src/components/miniflux/ImmersiveTranslationLayer.tsx`
- Modify: `src/components/miniflux/SafeHtml.test.tsx` (add tests)

**Step 1: Read `SafeHtml.test.tsx` to understand test structure**

Note the mocking patterns and how the component is rendered.

**Step 2: Write failing test in `SafeHtml.test.tsx`**

```typescript
describe('onTranslateNode', () => {
  it('renders enabled Translate menu item when onTranslateNode is provided', async () => {
    const onTranslateNode = vi.fn();
    render(
      <SafeHtml
        html="<p>Hello world, this is a test paragraph.</p>"
        onTranslateNode={onTranslateNode}
      />
    );

    // Hover to reveal the menu trigger
    const nodeBlock = screen.getByTestId('reader-node-block') // or use data-reader-node selector
    // ... find the ⋮ button and click to open menu
    // ... find "Translate this paragraph" and click
    // expect(onTranslateNode).toHaveBeenCalledWith('Hello world, this is a test paragraph.');
  });
});
```

Run to confirm it fails:
```bash
bun run test src/components/miniflux/SafeHtml.test.tsx 2>&1 | tail -20
```

**Step 3: Add `onTranslateNode` prop to `SafeHtml`**

In `SafeHtmlProps` interface (around line 52):
```typescript
interface SafeHtmlProps {
  // ... existing props ...
  onTranslateNode?: (text: string) => void;
}
```

In the `SafeHtml` function signature, destructure `onTranslateNode`:
```typescript
export function SafeHtml({
  // ... existing ...
  onTranslateNode,
}: SafeHtmlProps) {
```

**Step 4: Add translated label**

Near the other label declarations (around line 648):
```typescript
const translateParagraphLabel = _(msg`Translate this paragraph`);
```

**Step 5: Add `onTranslateNode` to `useMemo` dependency array**

In the `options` useMemo, add `onTranslateNode` and `translateParagraphLabel` to the dependency array.

**Step 6: Replace the disabled Translation MenuItem**

In `wrapReaderNodeBlock`, find the Translation MenuGroup (around line 1183). Replace the single disabled `MenuItem` with:

```tsx
<MenuGroup>
  <MenuGroupLabel className="px-2.5 pb-1 pt-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/90">
    {translationActionsLabel}
  </MenuGroupLabel>
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
</MenuGroup>
```

**Step 7: Wire `onTranslateNode` in `ImmersiveTranslationLayer`**

Add a `handleTranslateNode` callback in `ImmersiveTranslationLayer`:

```typescript
const handleTranslateNode = useCallback(
  (text: string) => {
    const segment = segments.find((s) => s.text === text);
    if (!segment) return;
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    void translateSegment(segment, requestId, sourceLanguage, translationPreferences);
  },
  [segments, translateSegment, sourceLanguage, translationPreferences]
);
```

Pass it to `SafeHtml` in the main return:
```tsx
<SafeHtml
  html={translatedHtml}
  ...
  onTranslateNode={handleTranslateNode}
/>
```

**Step 8: Run all tests**

```bash
bun run test src/components/miniflux/SafeHtml.test.tsx src/components/miniflux/ImmersiveTranslationLayer.test.tsx 2>&1 | tail -20
```

Expected: all pass.

**Step 9: TypeScript check + commit**

```bash
bun run typecheck 2>&1 | tail -5
git add src/components/miniflux/SafeHtml.tsx src/components/miniflux/SafeHtml.test.tsx src/components/miniflux/ImmersiveTranslationLayer.tsx
git commit -m "feat(reader): Enable per-node translate via node card menu"
```

---

### Task 6: `TranslationProgressRing` component

**Files:**
- Create: `src/components/miniflux/TranslationProgressRing.tsx`
- Create: `src/components/miniflux/TranslationProgressRing.test.tsx`

**Step 1: Write the failing test first**

Create `src/components/miniflux/TranslationProgressRing.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TranslationProgressRing } from './TranslationProgressRing';

describe('TranslationProgressRing', () => {
  it('shows completed count in the center', () => {
    render(<TranslationProgressRing completed={3} total={10} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows checkmark when complete', () => {
    render(<TranslationProgressRing completed={10} total={10} />);
    expect(screen.getByTestId('progress-ring-complete')).toBeInTheDocument();
  });

  it('does not render when total is 0', () => {
    const { container } = render(<TranslationProgressRing completed={0} total={0} />);
    expect(container.firstChild).toBeNull();
  });
});
```

Run to confirm failure:
```bash
bun run test src/components/miniflux/TranslationProgressRing.test.tsx 2>&1 | tail -15
```

**Step 2: Create the component**

Create `src/components/miniflux/TranslationProgressRing.tsx`:

```tsx
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface TranslationProgressRingProps {
  completed: number;
  total: number;
}

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = 48;
const STROKE_WIDTH = 3;
const CENTER = SIZE / 2;

export function TranslationProgressRing({ completed, total }: TranslationProgressRingProps) {
  const [showComplete, setShowComplete] = useState(false);

  const isComplete = total > 0 && completed >= total;
  const progress = total > 0 ? completed / total : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  useEffect(() => {
    if (isComplete) {
      setShowComplete(true);
      const timer = window.setTimeout(() => {
        setShowComplete(false);
      }, 1200);
      return () => window.clearTimeout(timer);
    }
    setShowComplete(false);
  }, [isComplete]);

  const visible = total > 0 && (!isComplete || showComplete);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="fixed bottom-4 left-4 z-50"
          aria-label={`Translation progress: ${completed} of ${total}`}
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemax={total}
        >
          <div
            className="flex items-center justify-center rounded-full border border-border/60 bg-background/95 shadow-lg backdrop-blur-sm"
            style={{ width: SIZE, height: SIZE }}
          >
            <svg
              width={SIZE}
              height={SIZE}
              className="absolute inset-0 -rotate-90"
              aria-hidden="true"
            >
              {/* Background track */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                className="text-muted/40"
              />
              {/* Progress arc */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className="text-primary transition-[stroke-dashoffset] duration-300 ease-out"
              />
            </svg>

            {/* Center content */}
            <div className="relative z-10 flex items-center justify-center">
              {isComplete ? (
                <span
                  data-testid="progress-ring-complete"
                  className="text-sm font-semibold text-primary"
                >
                  ✓
                </span>
              ) : (
                <motion.span
                  key={completed}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.12 }}
                  className="text-xs font-semibold tabular-nums text-foreground"
                >
                  {completed}
                </motion.span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Step 3: Run tests**

```bash
bun run test src/components/miniflux/TranslationProgressRing.test.tsx 2>&1 | tail -15
```

Expected: 3 tests pass.

**Step 4: TypeScript check + commit**

```bash
bun run typecheck 2>&1 | tail -5
git add src/components/miniflux/TranslationProgressRing.tsx src/components/miniflux/TranslationProgressRing.test.tsx
git commit -m "feat(reader): Add circular translation progress ring component"
```

---

### Task 7: Wire up — progress ring + selection translate into EntryReading

**Files:**
- Modify: `src/components/miniflux/ImmersiveTranslationLayer.tsx`
- Modify: `src/components/miniflux/EntryReading.tsx`

**Step 1: Expose progress state from `ImmersiveTranslationLayer`**

Add `TranslationProgressRing` import and render it inside `ImmersiveTranslationLayer`'s return JSX. Compute progress from `segmentStates`:

```typescript
const completedCount = Object.values(segmentStates).filter(
  (s) => s.status === 'success' || s.status === 'error'
).length;
```

Add to the main return div (after the failed segments block):
```tsx
{translationEnabled && (
  <TranslationProgressRing completed={completedCount} total={segments.length} />
)}
```

Import at top:
```typescript
import { TranslationProgressRing } from './TranslationProgressRing';
```

**Step 2: Wire `ReaderSelectionTranslatePopover` in `EntryReading.tsx`**

Read `EntryReading.tsx` to find where `ImmersiveTranslationLayer` is rendered in the JSX (search for `ImmersiveTranslationLayer`).

Import at the top of `EntryReading.tsx`:
```typescript
import { ReaderSelectionTranslatePopover } from './ReaderSelectionTranslatePopover';
```

Find the line rendering `<ImmersiveTranslationLayer` and wrap it:

```tsx
<ReaderSelectionTranslatePopover
  translationPreferences={translationPreferences}
  sourceLanguage={sourceLanguage ?? null}
>
  <ImmersiveTranslationLayer
    ... (existing props unchanged)
  />
</ReaderSelectionTranslatePopover>
```

Where `translationPreferences` is the object already constructed in `EntryReading` from `useReaderSettings` fields, and `sourceLanguage` comes from the entry's feed language or detection.

**Step 3: Verify `translationPreferences` object exists in EntryReading**

Read lines 70–200 of `EntryReading.tsx` to confirm how `translationPreferences` is assembled for `ImmersiveTranslationLayer`. It should already be constructed there.

**Step 4: TypeScript check**

```bash
bun run typecheck 2>&1 | tail -5
```

**Step 5: Run full frontend test suite**

```bash
bun run test 2>&1 | tail -20
```

Expected: all pass.

**Step 6: Commit**

```bash
git add src/components/miniflux/ImmersiveTranslationLayer.tsx src/components/miniflux/EntryReading.tsx
git commit -m "feat(reader): Wire progress ring and selection translate popover"
```

---

### Task 8: Short paragraph skip (20-char threshold)

**Files:**
- Modify: `src/components/miniflux/ImmersiveTranslationLayer.tsx`
- Modify: `src/components/miniflux/ImmersiveTranslationLayer.test.tsx`

**Step 1: Write failing test**

In `ImmersiveTranslationLayer.test.tsx`, add:

```typescript
it('skips paragraphs shorter than 20 characters from auto-translation', async () => {
  // Render with HTML containing a short paragraph (< 20 chars) and a long one
  // Trigger translation
  // Verify translateReaderSegment called only once (for the long paragraph)
  // Verify short paragraph is untouched
});
```

Run to confirm failure.

**Step 2: Update `extractParagraphSegments`**

In `ImmersiveTranslationLayer.tsx`, find:
```typescript
.filter((segment) => segment.text.length > 0);
```

Replace with:
```typescript
.filter((segment) => segment.text.length >= 20);
```

**Step 3: Run tests**

```bash
bun run test src/components/miniflux/ImmersiveTranslationLayer.test.tsx 2>&1 | tail -20
```

Expected: all tests pass including the new short-paragraph test.

**Step 4: Commit**

```bash
git add src/components/miniflux/ImmersiveTranslationLayer.tsx src/components/miniflux/ImmersiveTranslationLayer.test.tsx
git commit -m "feat(reader): Skip short paragraphs (< 20 chars) from auto-translation"
```

---

### Task 9: Quality gate

**Step 1: Run full check suite**

```bash
bun run check:all 2>&1 | tail -40
```

Note: pre-existing keychain test failures in `accounts::keyring` and `commands::accounts` are unrelated to this feature — only fail if new errors appear.

**Step 2: Run Rust tests**

```bash
cd src-tauri && cargo test 2>&1 | tail -20
```

Expected: new cache tests pass, pre-existing keychain failures unchanged.

**Step 3: Run all frontend tests**

```bash
bun run test 2>&1 | tail -20
```

Expected: all test files pass.

**Step 4: Fix any failures before proceeding**

If `bun run check:all` reports new Biome or TypeScript errors, fix them before marking complete.
