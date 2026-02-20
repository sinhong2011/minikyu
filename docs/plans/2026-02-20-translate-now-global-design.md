# Translate Now — Global Persistent Preference

**Date:** 2026-02-20
**Status:** Approved

## Problem

The "Translate now" switch in `EntryReadingHeader` controls a local `useState(false)` in `EntryReading.tsx`. It resets to `false` every time `entryId` changes, so enabling translation for one article has no effect on the next. This is confusing — users expect a "translate" toggle to apply globally.

## Goal

Make "Translate now" a persistent preference, following the same pattern as `reader_translation_display_mode` and `reader_translation_target_language`. Enabling it once keeps it on for all entries and survives app restarts. Disabling it persists too.

## Design

### Rust — `src-tauri/src/types.rs`

Add one field to `AppPreferences`:

```rust
#[serde(default)]
pub reader_translation_auto_enabled: bool,
```

`serde(default)` means existing saved preferences (without this field) deserialize to `false` — no migration needed.

### TypeScript Bindings

Run `bun run codegen:tauri` after Rust change. Produces `reader_translation_auto_enabled: boolean` in `AppPreferences`.

### Hook — `src/hooks/use-reader-settings.ts`

Follow the existing pattern:

```typescript
translationAutoEnabled: preferences?.reader_translation_auto_enabled ?? false,
setTranslationAutoEnabled: (enabled: boolean) =>
  updateSetting('reader_translation_auto_enabled', enabled),
```

### `EntryReading.tsx` — three changes

1. **Read preference from hook** and maintain a ref (consistent with `toggleEntryReadRef`, `entryRef` pattern):

```typescript
const { translationAutoEnabled, setTranslationAutoEnabled } = useReaderSettings();
const translationAutoEnabledRef = useRef(translationAutoEnabled);
translationAutoEnabledRef.current = translationAutoEnabled;
```

2. **Entry change effect** — initialize from preference instead of always `false`/`0`:

```typescript
useEffect(() => {
  if (!entryId) return;
  const shouldTranslate = translationAutoEnabledRef.current;
  setTranslationEnabled(shouldTranslate);
  setTranslateRequestToken(shouldTranslate ? 1 : 0);
  setActiveTranslationProvider(null);
}, [entryId]);
```

3. **Toggle handler** — also saves to preference:

```typescript
const handleTranslationEnabledChange = useCallback((enabled: boolean) => {
  setTranslationEnabled(enabled);
  setTranslationAutoEnabled(enabled);
  if (enabled) {
    setTranslateRequestToken((prev) => prev + 1);
  }
}, [setTranslationAutoEnabled]);
```

### `EntryReadingHeader.tsx` — update description

Switch sub-description updated from "Translate this article and tune how translated text is shown." to "Applies to all articles when enabled."

### Tests

- `use-reader-settings.translation.test.ts`: add two tests for `translationAutoEnabled` and `setTranslationAutoEnabled`

### i18n

Run `bun run i18n:extract && bun run i18n:compile` after updating the description string.

## Out of Scope

- Per-feed or per-category auto-translation
- Validation (boolean field, no constraints needed)
