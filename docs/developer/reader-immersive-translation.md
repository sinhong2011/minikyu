# Reader Immersive Translation

Architecture and implementation notes for immersive translation in the reader.

## Scope

V1 supports:

- Reader-only translation UI (no app-wide translation)
- `bilingual` and `translated_only` display modes
- Mixed trigger mode (manual + per-article auto)
- Engine-first fallback routing with optional Apple built-in fallback
- Provider key management via OS keyring

V1 does not support persistent translation memory or cross-device sync.

## Frontend Flow

### Reader translation rendering

1. `EntryReading` computes translation preferences from `useReaderSettings`.
2. `EntryReadingHeader` exposes a single translation popover control:
   - translate now
   - auto for this article
   - display mode
   - active provider
3. `ImmersiveTranslationLayer` manages paragraph-level translation state:
   - `idle | loading | success | error`
   - retry at segment level
   - mode-specific rendering for `bilingual` and `translated_only`
4. `src/services/translation/router.ts` maps frontend preferences to backend command payload.

### Selection translation

`ReaderSelectionTranslatePopover` listens for selection events and calls the same routing service with selected text, then shows translated snippet and provider used.

## Backend Flow

### Commands

`src-tauri/src/commands/translation.rs` exposes:

- `translate_reader_segment`
- `save_translation_provider_key`
- `delete_translation_provider_key`
- `get_translation_provider_key_status`

### Routing policy

`translate_reader_segment` applies deterministic fallback order:

1. primary engine
2. engine fallbacks (in configured order)
3. Apple built-in fallback (when enabled and available)
4. LLM fallbacks (in configured order)

The response returns:

- translated text
- provider actually used
- fallback chain that was attempted

## Provider Credentials and Security

- Keys are stored in system keyring entries with namespace:
  - `minikyu:translation:{provider}:{profile}`
- Frontend never reads raw key values.
- Frontend only gets configured/not configured status.
- Provider keys are managed from Advanced preferences pane.

## Preferences Contract

Translation behavior is driven by `AppPreferences` fields:

- `reader_translation_display_mode`
- `reader_translation_trigger_mode`
- `reader_translation_route_mode`
- `reader_translation_target_language`
- `reader_translation_primary_engine`
- `reader_translation_engine_fallbacks`
- `reader_translation_llm_fallbacks`
- `reader_translation_apple_fallback_enabled`

## Error Handling

Design target is per-segment resilience:

- segment failure must not block the whole article
- retry is local to the failed segment
- fallback can recover automatically with provider switch

Avoid logging raw article content and never log API keys.

## Testing Guidance

### TypeScript

- `src/services/translation/router.test.ts`
- `src/hooks/use-reader-settings.translation.test.ts`
- `src/components/miniflux/ImmersiveTranslationLayer.test.tsx`
- `src/components/miniflux/ReaderSelectionTranslatePopover.test.tsx`
- `src/components/preferences/panes/AdvancedPane.translation.test.tsx`

### Rust

- `src-tauri/src/commands/translation.test.rs`
- `src-tauri/src/commands/translation_router.test.rs`
- `src-tauri/src/types.rs` translation preference validation tests

### Verification commands

```bash
bun run test:run src/services/translation/router.test.ts src/hooks/use-reader-settings.translation.test.ts src/components/miniflux/ImmersiveTranslationLayer.test.tsx src/components/miniflux/ReaderSelectionTranslatePopover.test.tsx src/components/preferences/panes/AdvancedPane.translation.test.tsx
cd src-tauri && cargo test translation
cd src-tauri && cargo build --lib
bun run typecheck
```

## Extending Providers

To add a new provider:

1. Add provider identifier to frontend provider list in `AdvancedPane`.
2. Add routing/adapter logic in backend translation command module.
3. Add keyring status/save/delete test coverage.
4. Add router fallback tests for the new provider path.
5. Update this document and user-facing preferences strings.
