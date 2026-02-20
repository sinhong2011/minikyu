# Translate Now Global Preference — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make "Translate now" a persistent `AppPreferences` field so enabling translation once applies to all entries and survives app restarts.

**Architecture:** Add `reader_translation_auto_enabled: bool` to Rust `AppPreferences`, expose via `useReaderSettings`, initialize `translationEnabled` from the preference on entry change, and save it when the switch is toggled.

**Tech Stack:** Rust (serde), tauri-specta codegen, TypeScript, React, Vitest, Lingui i18n

---

### Task 1: Add `reader_translation_auto_enabled` to `AppPreferences`

**Files:**
- Modify: `src-tauri/src/types.rs`
- Test: `src-tauri/src/tests/preferences_tests.rs` (or nearest test file for AppPreferences)

**Step 1: Read current `AppPreferences` struct**

Read `src-tauri/src/types.rs`. Find the `AppPreferences` struct and note its last field.

**Step 2: Write a failing test**

Find the existing preferences test file. Add:

```rust
#[test]
fn deserialize_app_preferences_missing_translation_auto_enabled_defaults_to_false() {
    // Simulates existing saved preferences that lack the new field
    let json = r#"{
        "miniflux_url": null,
        "miniflux_api_key": null,
        "reader_translation_auto_enabled": null
    }"#;
    // Should deserialize without error and default to false
    let result: Result<AppPreferences, _> = serde_json::from_str(json);
    // This test verifies the field exists and has a serde default
    assert!(result.is_ok() || true); // Replace with actual assertion once field exists
}
```

Actually, write this test to verify the new field exists with serde default:

```rust
#[test]
fn app_preferences_translation_auto_enabled_defaults_to_false() {
    let prefs = AppPreferences::default();
    assert!(!prefs.reader_translation_auto_enabled);
}

#[test]
fn app_preferences_translation_auto_enabled_deserializes_missing_field_as_false() {
    let json = "{}";
    let prefs: AppPreferences = serde_json::from_str(json).unwrap();
    assert!(!prefs.reader_translation_auto_enabled);
}
```

**Step 3: Run tests to confirm they fail**

```bash
cd /path/to/worktree && cargo test translation_auto_enabled 2>&1 | head -30
```

Expected: compile error (field doesn't exist yet).

**Step 4: Add the field to `AppPreferences`**

In `src-tauri/src/types.rs`, add after the last `reader_translation_*` field:

```rust
#[serde(default)]
pub reader_translation_auto_enabled: bool,
```

**Step 5: Run tests to confirm they pass**

```bash
cargo test translation_auto_enabled 2>&1
```

Expected: both tests pass.

**Step 6: Full Rust build check**

```bash
cargo build --lib 2>&1 | tail -20
```

Expected: no errors.

**Step 7: Commit**

```bash
git add src-tauri/src/types.rs src-tauri/src/tests/
git commit -m "feat(tauri): Add reader_translation_auto_enabled to AppPreferences"
```

---

### Task 2: Regenerate TypeScript bindings

**Files:**
- Auto-generated: `src/lib/tauri-bindings.ts`

**Step 1: Run codegen**

```bash
bun run codegen:tauri 2>&1
```

Expected: exits 0, `src/lib/tauri-bindings.ts` updated.

**Step 2: Verify the new field appears**

Search for `reader_translation_auto_enabled` in `src/lib/tauri-bindings.ts`:

```bash
grep -n "reader_translation_auto_enabled" src/lib/tauri-bindings.ts
```

Expected: `reader_translation_auto_enabled: boolean` found.

**Step 3: Commit**

```bash
git add src/lib/tauri-bindings.ts
git commit -m "chore: Regenerate TypeScript bindings for reader_translation_auto_enabled"
```

---

### Task 3: Add `translationAutoEnabled` to `useReaderSettings`

**Files:**
- Modify: `src/hooks/use-reader-settings.ts`
- Test: `src/hooks/use-reader-settings.translation.test.ts`

**Step 1: Read both files**

Read `src/hooks/use-reader-settings.ts` fully to understand the return object structure and `updateSetting` pattern. Read `src/hooks/use-reader-settings.translation.test.ts` to understand test setup.

**Step 2: Write failing tests**

Add to `use-reader-settings.translation.test.ts`:

```typescript
describe('translationAutoEnabled', () => {
  it('defaults to false when preference is not set', () => {
    // Set up mock preferences without reader_translation_auto_enabled
    // Render hook
    // Expect result.current.translationAutoEnabled === false
  });

  it('reads reader_translation_auto_enabled from preferences', () => {
    // Set up mock preferences with reader_translation_auto_enabled: true
    // Render hook
    // Expect result.current.translationAutoEnabled === true
  });

  it('setTranslationAutoEnabled calls updateSetting with correct args', () => {
    // Render hook
    // Call result.current.setTranslationAutoEnabled(true)
    // Expect updateSetting called with ('reader_translation_auto_enabled', true)
  });
});
```

Follow the existing test patterns (mock `usePreferencesQuery`, mock `useUpdatePreference`) exactly as done for `setTranslationDisplayMode` tests.

**Step 3: Run tests to confirm they fail**

```bash
bun run test src/hooks/use-reader-settings.translation.test.ts 2>&1 | tail -20
```

Expected: fail (property doesn't exist yet).

**Step 4: Add to `use-reader-settings.ts`**

In the return object of `useReaderSettings`, add alongside the other `translation*` entries:

```typescript
translationAutoEnabled: preferences?.reader_translation_auto_enabled ?? false,
setTranslationAutoEnabled: (enabled: boolean) =>
  updateSetting('reader_translation_auto_enabled', enabled),
```

Also update the TypeScript return type annotation of the hook if it has an explicit interface/type.

**Step 5: Run tests to confirm they pass**

```bash
bun run test src/hooks/use-reader-settings.translation.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

**Step 6: Commit**

```bash
git add src/hooks/use-reader-settings.ts src/hooks/use-reader-settings.translation.test.ts
git commit -m "feat: Expose translationAutoEnabled in useReaderSettings"
```

---

### Task 4: Wire `translationAutoEnabled` into `EntryReading.tsx`

**Files:**
- Modify: `src/components/miniflux/EntryReading.tsx`

**Step 1: Read `EntryReading.tsx` lines 70–120 and 585–600**

Focus on:
- `useReaderSettings()` destructuring (lines ~70–95)
- `translationEnabled` and `translateRequestToken` state declarations (lines ~114–115)
- The `useEffect([entryId])` that resets translation state (lines ~399–406)
- `handleTranslationEnabledChange` callback (lines ~592–597)

**Step 2: Add to the `useReaderSettings()` destructuring**

Add `translationAutoEnabled` and `setTranslationAutoEnabled` to the existing destructure:

```typescript
const {
  // ... existing fields ...
  translationAutoEnabled,
  setTranslationAutoEnabled,
} = useReaderSettings();
```

**Step 3: Add the ref (after existing ref declarations ~lines 99–108)**

```typescript
const translationAutoEnabledRef = useRef(translationAutoEnabled);
translationAutoEnabledRef.current = translationAutoEnabled;
```

**Step 4: Update the `useEffect([entryId])` entry reset**

Change from:
```typescript
useEffect(() => {
  if (!entryId) {
    return;
  }
  setTranslationEnabled(false);
  setTranslateRequestToken(0);
  setActiveTranslationProvider(null);
}, [entryId]);
```

To:
```typescript
useEffect(() => {
  if (!entryId) {
    return;
  }
  const shouldTranslate = translationAutoEnabledRef.current;
  setTranslationEnabled(shouldTranslate);
  setTranslateRequestToken(shouldTranslate ? 1 : 0);
  setActiveTranslationProvider(null);
}, [entryId]);
```

**Step 5: Update `handleTranslationEnabledChange`**

Change from:
```typescript
const handleTranslationEnabledChange = useCallback((enabled: boolean) => {
  setTranslationEnabled(enabled);
  if (enabled) {
    setTranslateRequestToken((previousToken) => previousToken + 1);
  }
}, []);
```

To:
```typescript
const handleTranslationEnabledChange = useCallback(
  (enabled: boolean) => {
    setTranslationEnabled(enabled);
    setTranslationAutoEnabled(enabled);
    if (enabled) {
      setTranslateRequestToken((previousToken) => previousToken + 1);
    }
  },
  [setTranslationAutoEnabled]
);
```

**Step 6: TypeScript check**

```bash
bun run typecheck 2>&1 | tail -20
```

Expected: no errors.

**Step 7: Commit**

```bash
git add src/components/miniflux/EntryReading.tsx
git commit -m "feat(reader): Persist translation enabled state as AppPreference"
```

---

### Task 5: Update description text in `EntryReadingHeader.tsx` + i18n

**Files:**
- Modify: `src/components/miniflux/EntryReadingHeader.tsx`

**Step 1: Read `EntryReadingHeader.tsx` lines 326–345**

Find the switch sub-description (currently `"Translate this article and tune how translated text is shown."`).

**Step 2: Update the switch description only**

Change line 337 (the `<p>` inside the switch row) from:
```tsx
{_(msg`Translate this article and tune how translated text is shown.`)}
```
To:
```tsx
{_(msg`Applies to all articles when enabled`)}
```

Leave the popover title description at line 329 unchanged (it describes the popover as a whole, still accurate).

**Step 3: Run i18n extraction and compilation**

```bash
bun run i18n:extract 2>&1 && bun run i18n:compile 2>&1
```

Expected: no errors. New message key added to `src/locales/en/messages.po`.

**Step 4: TypeScript check**

```bash
bun run typecheck 2>&1 | tail -10
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/components/miniflux/EntryReadingHeader.tsx src/locales/
git commit -m "feat(reader): Update Translate now switch description to reflect global behavior"
```

---

### Task 6: Quality gate

**Step 1: Run full check suite**

```bash
bun run check:all 2>&1
```

Note: pre-existing lint warnings in `SplashScreen.tsx` (from PR #10) are unrelated — only fail if new errors appear.

**Step 2: Run Rust tests specifically**

```bash
cargo test 2>&1 | tail -30
```

Expected: all tests pass.

**Step 3: Run frontend tests**

```bash
bun run test 2>&1 | tail -30
```

Expected: all tests pass.

**Step 4: If any failures**: fix them before proceeding.
