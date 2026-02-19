# Immersive Reader Translation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add immersive translation inside the reader with bilingual/translated-only modes, mixed trigger behavior, engine-first routing, and Apple built-in fallback.

**Architecture:** Build a backend translation domain with provider adapters + routing + keyring-backed secrets, then wire a frontend reader orchestrator that translates paragraph blocks and renders mode-specific output.

**Tech Stack:** Tauri v2, Rust, tauri-specta, React 19, TanStack Query, Zustand, Lingui, Vitest

---

## Implementation Notes

1. Use `@test-driven-development` on each task (red -> green -> refactor).
2. Use `@verification-before-completion` before claiming done.
3. Use bun commands only.
4. Do not commit unless user explicitly asks for commits.

---

### Task 1: Add Failing Tests for New Translation Preferences

**Files:**
- Modify: `src/services/preferences.test.ts`
- Modify: `src/test/setup.ts`
- Modify: `src-tauri/src/types.rs`

**Step 1: Write failing TS test for expected preference fields**

Add assertions in `src/services/preferences.test.ts` for:

```typescript
expect(result.data.reader_translation_display_mode).toBeDefined();
expect(result.data.reader_translation_trigger_mode).toBeDefined();
expect(result.data.reader_translation_route_mode).toBeDefined();
expect(result.data.reader_translation_apple_fallback_enabled).toBeDefined();
```

**Step 2: Run test and verify RED**

Run:
```bash
bun run test:run src/services/preferences.test.ts
```

Expected: FAIL because fields do not exist in generated bindings/default mock.

**Step 3: Write failing Rust unit tests for default values**

In `src-tauri/src/types.rs` test module, add tests asserting default values for new fields.

**Step 4: Run Rust tests and verify RED**

Run:
```bash
cd src-tauri && cargo test types::tests
```

Expected: FAIL because fields/types are missing.

---

### Task 2: Implement Translation Preference Types and Validation (Rust + Frontend Defaults)

**Files:**
- Modify: `src-tauri/src/types.rs`
- Modify: `src-tauri/src/commands/preferences.rs`
- Modify: `src/services/preferences.ts`
- Modify: `src/test/setup.ts`

**Step 1: Add new enums and fields in `AppPreferences`**

In `src-tauri/src/types.rs`, add enums:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "snake_case")]
pub enum ReaderTranslationDisplayMode { #[default] Bilingual, TranslatedOnly }

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "snake_case")]
pub enum ReaderTranslationTriggerMode { #[default] Manual, PerArticleAuto }

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "snake_case")]
pub enum ReaderTranslationRouteMode { #[default] EngineFirst, HybridAuto }
```

Add fields to `AppPreferences`:

```rust
pub reader_translation_display_mode: ReaderTranslationDisplayMode,
pub reader_translation_trigger_mode: ReaderTranslationTriggerMode,
pub reader_translation_route_mode: ReaderTranslationRouteMode,
pub reader_translation_target_language: Option<String>,
pub reader_translation_primary_engine: Option<String>,
pub reader_translation_engine_fallbacks: Vec<String>,
pub reader_translation_llm_fallbacks: Vec<String>,
pub reader_translation_apple_fallback_enabled: bool,
```

**Step 2: Fill default values**

In `Default for AppPreferences`, set:

```rust
reader_translation_display_mode: ReaderTranslationDisplayMode::Bilingual,
reader_translation_trigger_mode: ReaderTranslationTriggerMode::Manual,
reader_translation_route_mode: ReaderTranslationRouteMode::EngineFirst,
reader_translation_target_language: None,
reader_translation_primary_engine: None,
reader_translation_engine_fallbacks: vec![],
reader_translation_llm_fallbacks: vec![],
reader_translation_apple_fallback_enabled: true,
```

**Step 3: Add validation helpers**

In `src-tauri/src/types.rs`, add validation for fallback list lengths and item length bounds.

**Step 4: Call validation in save_preferences**

In `src-tauri/src/commands/preferences.rs`, call the new validation functions during save.

**Step 5: Update frontend defaults and test mock**

Add default fields in:
- `src/services/preferences.ts` fallback object
- `src/test/setup.ts` mocked `commands.loadPreferences` data

**Step 6: Run tests and verify GREEN**

Run:
```bash
bun run test:run src/services/preferences.test.ts
cd src-tauri && cargo test types::tests
```

Expected: PASS.

---

### Task 3: Add Backend Keyring API for Translation Providers

**Files:**
- Create: `src-tauri/src/commands/translation.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs` (module registration only if needed)
- Create: `src-tauri/src/commands/translation.test.rs`

**Step 1: Write failing Rust tests for provider key status API**

Create tests for:

1. save provider key -> status true
2. delete provider key -> status false
3. unknown provider/profile returns false

**Step 2: Run test and verify RED**

Run:
```bash
cd src-tauri && cargo test translation::tests
```

Expected: FAIL (module/commands absent).

**Step 3: Implement command APIs**

Implement in `src-tauri/src/commands/translation.rs`:

```rust
#[tauri::command]
#[specta::specta]
pub async fn save_translation_provider_key(provider: String, profile: String, api_key: String) -> Result<(), String>

#[tauri::command]
#[specta::specta]
pub async fn delete_translation_provider_key(provider: String, profile: String) -> Result<(), String>

#[tauri::command]
#[specta::specta]
pub async fn get_translation_provider_key_status(provider: String, profile: String) -> Result<bool, String>
```

Key naming convention:
`minikyu:translation:{provider}:{profile}`

Use keyring crate directly; never return key values.

**Step 4: Run tests and verify GREEN**

Run:
```bash
cd src-tauri && cargo test translation::tests
```

Expected: PASS.

---

### Task 4: Implement Translation Router Command (Engine-first + Apple Fallback + LLM Fallback)

**Files:**
- Modify: `src-tauri/src/commands/translation.rs`
- Create: `src-tauri/src/commands/translation_router.test.rs`

**Step 1: Write failing router tests**

Add tests for:

1. `engine_first` tries selected engine first
2. on engine failure and apple enabled, apple provider is attempted
3. if apple unavailable, first LLM fallback is attempted

**Step 2: Run tests and verify RED**

Run:
```bash
cd src-tauri && cargo test translation_router
```

Expected: FAIL because router function is missing.

**Step 3: Implement translation input/output types and router**

In `translation.rs`, add:

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
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TranslationSegmentResponse {
    pub translated_text: String,
    pub provider_used: String,
    pub fallback_chain: Vec<String>,
}
```

Add command:

```rust
#[tauri::command]
#[specta::specta]
pub async fn translate_reader_segment(request: TranslationSegmentRequest) -> Result<TranslationSegmentResponse, String>
```

Implement deterministic fallback order:
engine -> engine_fallbacks -> apple(optional) -> llm_fallbacks.

**Step 4: Run tests and verify GREEN**

Run:
```bash
cd src-tauri && cargo test translation_router
```

Expected: PASS.

---

### Task 5: Register Commands and Regenerate Bindings

**Files:**
- Modify: `src-tauri/src/bindings.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src/lib/bindings.ts` (generated)
- Modify: `src/lib/tauri-bindings.ts`

**Step 1: Add translation commands to collect_commands**

In `src-tauri/src/bindings.rs`, register:

1. `translation::save_translation_provider_key`
2. `translation::delete_translation_provider_key`
3. `translation::get_translation_provider_key_status`
4. `translation::translate_reader_segment`

**Step 2: Run bindings generation**

Run:
```bash
bun run rust:bindings
```

Expected: generated APIs appear in `src/lib/bindings.ts`.

**Step 3: Add frontend wrapper helpers**

In `src/lib/tauri-bindings.ts`, add normalized wrappers if needed (Result unwrap helpers, typed payload wrappers).

**Step 4: Verify build compiles**

Run:
```bash
cd src-tauri && cargo build --lib
bun run typecheck
```

Expected: PASS.

---

### Task 6: Build Frontend Translation Service and Query Layer

**Files:**
- Create: `src/services/translation/types.ts`
- Create: `src/services/translation/router.ts`
- Create: `src/services/translation/index.ts`
- Create: `src/services/translation/router.test.ts`

**Step 1: Write failing tests for route payload composition**

In `router.test.ts`, verify:

1. `engine_first` payload uses preferences values
2. when `apple fallback` enabled, payload field is true
3. fallback arrays are preserved in order

**Step 2: Run test and verify RED**

Run:
```bash
bun run test:run src/services/translation/router.test.ts
```

Expected: FAIL (service missing).

**Step 3: Implement translation service**

`router.ts` should call `commands.translateReaderSegment` with typed payload and return normalized response.

**Step 4: Run test and verify GREEN**

Run:
```bash
bun run test:run src/services/translation/router.test.ts
```

Expected: PASS.

---

### Task 7: Extend Reader Settings Hook for Translation Preferences

**Files:**
- Modify: `src/hooks/use-reader-settings.ts`
- Create: `src/hooks/use-reader-settings.translation.test.ts`

**Step 1: Write failing tests**

Assert hook exposes:

1. display mode get/set
2. trigger mode get/set
3. route mode get/set
4. apple fallback get/set

**Step 2: Run and verify RED**

Run:
```bash
bun run test:run src/hooks/use-reader-settings.translation.test.ts
```

Expected: FAIL (fields missing).

**Step 3: Implement hook extensions**

Add getters/setters around new preference keys and keep Zustand selector-safe usage pattern.

**Step 4: Run and verify GREEN**

Run:
```bash
bun run test:run src/hooks/use-reader-settings.translation.test.ts
```

Expected: PASS.

---

### Task 8: Implement Reader UI (Bilingual / Translated-only + Mixed Trigger)

**Files:**
- Modify: `src/components/miniflux/EntryReadingHeader.tsx`
- Modify: `src/components/miniflux/EntryReading.tsx`
- Create: `src/components/miniflux/ImmersiveTranslationLayer.tsx`
- Create: `src/components/miniflux/ImmersiveTranslationLayer.test.tsx`

**Step 1: Write failing component tests**

Test scenarios:

1. click `Translate` triggers segment translation requests
2. mode switch to `translated_only` hides original paragraph text nodes
3. `Auto for this article` true triggers translation on reopen for same entry
4. segment failure renders retry button

**Step 2: Run tests and verify RED**

Run:
```bash
bun run test:run src/components/miniflux/ImmersiveTranslationLayer.test.tsx
```

Expected: FAIL (component missing).

**Step 3: Implement `ImmersiveTranslationLayer`**

Responsibilities:

1. split/track paragraph segments
2. fetch visible-first
3. manage per-segment states
4. expose mode-specific rendering

**Step 4: Wire into `EntryReading`**

Render translated content through layer while preserving existing `SafeHtml` behavior when translation is disabled.

**Step 5: Update header controls**

Add toolbar controls:

1. Translate action
2. Auto-for-this-article toggle
3. display mode selector
4. active provider badge

**Step 6: Run tests and verify GREEN**

Run:
```bash
bun run test:run src/components/miniflux/ImmersiveTranslationLayer.test.tsx
```

Expected: PASS.

---

### Task 9: Implement Reader Selection Translation Popover

**Files:**
- Create: `src/components/miniflux/ReaderSelectionTranslatePopover.tsx`
- Modify: `src/components/miniflux/EntryReading.tsx`
- Create: `src/components/miniflux/ReaderSelectionTranslatePopover.test.tsx`

**Step 1: Write failing tests**

1. selecting text opens popover
2. popover calls translation command
3. fallback provider label visible in popover

**Step 2: Run and verify RED**

Run:
```bash
bun run test:run src/components/miniflux/ReaderSelectionTranslatePopover.test.tsx
```

Expected: FAIL (component missing).

**Step 3: Implement popover**

Use existing UI primitives and Lingui messages for all user-facing strings.

**Step 4: Run and verify GREEN**

Run:
```bash
bun run test:run src/components/miniflux/ReaderSelectionTranslatePopover.test.tsx
```

Expected: PASS.

---

### Task 10: Add Provider Settings UI in Preferences

**Files:**
- Modify: `src/components/preferences/panes/AdvancedPane.tsx`
- Create: `src/components/preferences/panes/AdvancedPane.translation.test.tsx`

**Step 1: Write failing tests**

1. provider list renders with enabled/status
2. save key action calls backend key command
3. route mode and apple fallback toggles persist preferences

**Step 2: Run and verify RED**

Run:
```bash
bun run test:run src/components/preferences/panes/AdvancedPane.translation.test.tsx
```

Expected: FAIL.

**Step 3: Implement translation settings section**

Add sections:

1. Route strategy (`engine_first | hybrid_auto`)
2. Apple fallback toggle
3. Primary engine select + fallback order inputs
4. Provider key status/actions (set/replace/remove key)

**Step 4: Run and verify GREEN**

Run:
```bash
bun run test:run src/components/preferences/panes/AdvancedPane.translation.test.tsx
```

Expected: PASS.

---

### Task 11: Update i18n and Documentation

**Files:**
- Modify: `src/locales/en/messages.po` (and locale peers after extract)
- Modify: `docs/developer/external-apis.md`
- Create: `docs/developer/reader-immersive-translation.md`

**Step 1: Add missing translatable strings in code first**

All new user-facing strings must use Lingui `msg`.

**Step 2: Extract and compile i18n catalogs**

Run:
```bash
bun run i18n:extract
bun run i18n:compile
```

Expected: catalogs updated and compile succeeds.

**Step 3: Document new architecture**

Add backend/frontend flow, fallback policy, keyring policy, and testing guidance.

---

### Task 12: Full Verification Gate

**Files:**
- No direct file edits (verification task)

**Step 1: Project quality checks**

Run:
```bash
bun run check:all
```

Expected: PASS.

**Step 2: Rust compile verification**

Run:
```bash
cd src-tauri && cargo build --lib
```

Expected: PASS.

**Step 3: App runtime verification**

Run:
```bash
bun run dev
```

Expected: app starts, reader loads, immersive translation controls visible and usable.

If local environment cannot run GUI, ask user to run and report startup/runtime behavior.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-02-18-immersive-reader-translation-implementation.md`.

Two execution options:

1. **Subagent-Driven (this session)** - execute tasks sequentially here with review checkpoints.
2. **Parallel Session (separate)** - open a separate execution session using `superpowers:executing-plans`.

Choose 1 or 2.

