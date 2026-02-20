# Translation UX Enhancements — Design

## Goal

Polish and extend the immersive translation feature with seven targeted improvements: visual feedback, persistent caching, per-node translate, selection translate, graceful cancellation, and a progress indicator.

## Architecture Overview

All enhancements build on the existing stack:

- `ImmersiveTranslationLayer.tsx` — orchestrates translation state and rendering
- `SafeHtml.tsx` — parses HTML into React, wraps every block in `.reader-node-block` with a `⋮` menu
- `ReaderSelectionTranslatePopover.tsx` — already complete, not yet wired in
- `animation.css` — CSS keyframes for all motion
- Tauri backend — new translation cache commands

---

## Section 1: Visual Polish — Shimmer + Appear Animation (Items 1 + 2)

### Shimmer on Node Card (Item 1)

**Problem:** The shimmer class is currently applied to the inner `<p>` element. The outer `.reader-node-block` card should glow instead.

**Solution:** CSS `:has()` selector — no React architecture changes needed.

Changes:
- `buildTranslatedHtml` adds `data-translation-loading="true"` attribute to loading paragraphs (instead of adding a CSS class)
- CSS targets the wrapper: `.reader-node-block:has([data-translation-loading])` gets the shimmer animation
- `prefers-reduced-motion` fallback: `outline` on `.reader-node-block` level

Result: the entire hoverable card pulses with iridescent light while its paragraph is being translated.

### Translated Paragraph Appear Animation (Item 2)

New CSS for `.reader-translation-block` (bilingual mode insertion):
```css
@keyframes translation-appear {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}
.reader-translation-block {
  animation: translation-appear 280ms cubic-bezier(0.22, 1, 0.36, 1);
}
```

For `translated_only` mode (text replacement): add `data-translation-just-replaced="true"` on the `<p>` after replacement; CSS drives the same animation via attribute selector.

`prefers-reduced-motion`: skip both animations.

---

## Section 2: Persistent Translation Cache (Item 3)

### Cache Key

```
{targetLanguage}:{sha256(text.trim())}
```

No `entryId` in the key — the same paragraph text translates identically regardless of source article, enabling cross-article reuse.

### Storage

New file: `{app_data_dir}/translation-cache.json`

```json
{
  "zh-TW:abc123def": {
    "translatedText": "...",
    "providerUsed": "openai",
    "cachedAt": 1740000000
  }
}
```

No TTL in V1 (cache grows indefinitely, manageable given typical article volumes).

### Tauri Commands

Two new Rust commands:
- `get_translation_cache_entry(key: String) → Option<TranslationCacheEntry>`
- `set_translation_cache_entry(key: String, entry: TranslationCacheEntry)`

TypeScript bindings regenerated via `bun run rust:bindings`.

### React Integration

In `translateSegment` within `ImmersiveTranslationLayer`:
1. Compute cache key from `targetLanguage + sha256(text)`
2. Query `get_translation_cache_entry` — if hit: immediately set `status: 'success'` (no shimmer, instant display)
3. If miss: translate normally, on success call `set_translation_cache_entry`

Cache hits feel instant — no shimmer plays, translated text appears directly. Only live API calls show the shimmer animation. This gives users clear visual feedback about cache vs. live translation.

---

## Section 3: Per-Node and Selection Translation (Items 5 + 6)

### Per-Node Translate via ⋮ Menu (Item 5)

**New prop on `SafeHtml`:**
```typescript
onTranslateNode?: (text: string, nodeIndex: number) => void
```

In `wrapReaderNodeBlock`, the Translation `MenuGroup`:
- **`onTranslateNode` provided** → enable "Translate this paragraph" `MenuItem`
- **Not provided** → keep existing disabled hint ("Translation controls in top bar")

`ImmersiveTranslationLayer` passes the callback. On trigger:
1. Find the segment whose text matches `nodeText` (text comparison)
2. Translate that single segment with the same shimmer → result flow as full translation
3. Follows global `translationDisplayMode` (bilingual or translated_only)
4. Checks cache first, writes to cache on success

`ImmersiveTranslationLayer` always renders (no early return to plain `SafeHtml`) so per-node translate works even when global `translationEnabled = false`.

### Selection / Word Translate (Item 6)

`ReaderSelectionTranslatePopover` is already fully implemented. Wire it into `EntryReading.tsx`:

```tsx
<ReaderSelectionTranslatePopover
  translationPreferences={translationPreferences}
  sourceLanguage={sourceLanguage}
>
  <ImmersiveTranslationLayer ... />
</ReaderSelectionTranslatePopover>
```

Selecting any text in the reader shows the "Translate selection" popover button. No other changes needed to the existing component.

---

## Section 4: Graceful Mid-Translation Entry Switch (Item 4)

### AbortController for In-Flight Requests

Each translation batch gets an `AbortController`. On `entryId` change, the `useEffect` cleanup calls `abort()`. The `translateReaderSegmentWithPreferences` service function accepts and passes through an `AbortSignal` to the underlying fetch.

Result: network requests for the previous article are immediately cancelled, freeing resources.

### Flush Partial Results to Cache

In the `useEffect([entryId])` cleanup function, before resetting state:
- Iterate `segmentStates`
- For any segment with `status === 'success'`, call `set_translation_cache_entry`

On returning to a partially-translated article, the cache provides completed segments instantly. Untranslated segments re-translate normally.

---

## Section 5: Additional Enhancements (Item 7)

### Translation Progress Indicator

A floating pill fixed to `bottom-4 left-4`, animated:

**Appearance:** Small `rounded-full` pill, `bg-background/95 border border-border/60 shadow-lg`

**Content:**
- While translating: `3 / 12` with the numerator animating (counter flip) as each segment completes
- On completion: briefly shows a `✓` checkmark, then fades out

**Motion:**
- Enters: slide up + fade in (`translateY(8px) → 0`, `opacity 0 → 1`)
- Number update: individual digit flip animation
- Exits: fade out after 1.2s delay on completion

**Implementation:** `TranslationProgressPill` component, receives `completed: number` and `total: number` props. Renders with `framer-motion` `AnimatePresence` for enter/exit.

### Short Paragraph Skip

`extractParagraphSegments` adds a minimum character threshold (default: 20 chars). Paragraphs shorter than this (dates, bylines, single-word headings) are excluded from auto-translation. Reduces unnecessary API calls.

### Cache-Hit Visual Distinction

Segments resolved from cache never show the shimmer animation — they appear directly with the `.reader-translation-block` appear animation only. Live API calls show shimmer first, then appear animation. Users intuitively perceive the speed difference between cache and live.

---

## Component Changes Summary

| File | Change |
|------|--------|
| `src-tauri/src/types.rs` | New `TranslationCacheEntry` struct |
| `src-tauri/src/commands/translation_cache.rs` | New: `get_translation_cache_entry`, `set_translation_cache_entry` |
| `src-tauri/src/bindings.rs` | Register new commands |
| `src/lib/bindings.ts` | Regenerated |
| `src/styles/animation.css` | Shimmer on `:has()`, `translation-appear`, progress pill animations |
| `src/components/miniflux/ImmersiveTranslationLayer.tsx` | Cache integration, AbortController, per-node callback, progress state |
| `src/components/miniflux/SafeHtml.tsx` | `onTranslateNode` prop, enable Translation menu item |
| `src/components/miniflux/TranslationProgressPill.tsx` | New: floating progress indicator |
| `src/components/miniflux/EntryReading.tsx` | Wire `ReaderSelectionTranslatePopover`, pass progress state |
