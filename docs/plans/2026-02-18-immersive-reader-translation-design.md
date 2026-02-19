# Immersive Reader Translation Design

**Date:** 2026-02-18  
**Status:** Approved  
**Author:** Codex (with user approval)

## Overview

Implement immersive translation inside the Minikyu reader only, with:

1. `Bilingual` and `Translated-only` display modes
2. Mixed trigger mode (`manual` default + per-article auto)
3. Engine-first routing with fallback to Apple built-in translation on Apple platforms
4. Broad provider coverage:
   - LLM providers: OpenAI, Anthropic, Gemini, OpenRouter, GLM, Kimi, MiniMax, Qwen, DeepSeek
   - Translation engines: DeepL, Google Translate, Microsoft Translator, Qwen-MT, Hunyuan-MT, Baidu Translate

## Goals

1. Deliver immersive translation UX comparable to reader-style bilingual tools.
2. Keep latency and cost predictable with translation-engine-first routing.
3. Keep credentials secure (keyring only, never exposed to frontend).
4. Make provider expansion a config + adapter task, not an architectural rewrite.

## Non-Goals (V1)

1. Browser-wide translation outside Minikyu reader.
2. Full-page OCR translation pipeline.
3. Persistent cross-device translation memory.

## UX Design

### Reader Toolbar

Add a translation control group to `EntryReadingHeader`:

1. `Translate` button (manual trigger)
2. `Auto for this article` toggle
3. Display mode toggle:
   - `Bilingual`
   - `Translated only`
4. Active provider badge (shows actual provider used after fallback)

### Reading Content Behavior

1. Paragraph-level translation units.
2. Translate visible paragraphs first, then prefetch nearby paragraphs.
3. `Bilingual` mode:
   - Original paragraph on top
   - Translation block below
4. `Translated only` mode:
   - Replace visual paragraph content with translation
   - Keep one-click view-original affordance

### Selection Translation

1. On text selection, show lightweight inline popover.
2. Display short translation / gloss.
3. Optional action to add terminology override (future-ready link to custom conversion rules).

## System Architecture

### Frontend

Introduce `ImmersiveTranslationOrchestrator` in reader domain:

1. Segment entry HTML/text into paragraph tasks.
2. Submit tasks to backend command(s).
3. Track per-paragraph status: idle/loading/success/error.
4. Maintain in-memory cache for current session.
5. Render output according to display mode.

### Backend (Tauri)

Add a dedicated translation command module:

1. Provider adapters:
   - `TranslationEngineProvider` adapters
   - `LlmProvider` adapters
   - `AppleBuiltInProvider` adapter (Apple-only fallback)
2. `TranslationRouter`:
   - Strategy: `engine_first` (default)
   - Strategy: `hybrid_auto` (optional mode)
3. Unified error model and fallback pipeline.

## Routing Strategy

### Primary Modes

1. `engine_first`:
   - Use chosen translation engine first
   - Fallback chain:
     - same-category backup engine
     - Apple built-in translation (if enabled + supported)
     - LLM fallback list
2. `hybrid_auto`:
   - Automatically choose engine vs LLM by segment length, language pair, and availability
   - Keep same fallback chain

### Apple Built-In Fallback

User-approved policy: Apple built-in translation is fallback, not primary.

1. Triggered only when upstream provider fails/limits/timeouts.
2. Enabled by preference flag.
3. Runtime capability check for platform and language support.

## Configuration Model

Extend `AppPreferences` with translation settings:

1. `reader_translation_display_mode`: `bilingual | translated_only`
2. `reader_translation_trigger_mode`: `manual | per_article_auto`
3. `reader_translation_route_mode`: `engine_first | hybrid_auto`
4. `reader_translation_target_language`: string
5. `reader_translation_primary_engine`: string
6. `reader_translation_engine_fallbacks`: string[]
7. `reader_translation_llm_fallbacks`: string[]
8. `reader_translation_apple_fallback_enabled`: boolean

Provider runtime settings (non-secret) stay in preferences:

1. enabled
2. base_url
3. model
4. timeout

Secrets (API keys) are keyring-only.

## Credential Security

### Keyring

Store per-provider credentials in Rust keyring:

1. Save/update key
2. Delete key
3. Report configured/not-configured status only

No plaintext key passes from backend to frontend.

## Data and Caching

Paragraph cache key:

`entryId + paragraphHash + sourceLang + targetLang + provider + model + displayMode`

V1 cache scope:

1. In-memory only (session scope)
2. Optional disk cache deferred to V2

## Error Handling

Per-paragraph resilient behavior:

1. One paragraph failure does not block full article.
2. Surface structured error reason:
   - `auth_invalid`
   - `rate_limited`
   - `network`
   - `timeout`
   - `unsupported_language_pair`
3. Show retry action at paragraph level.
4. Show fallback provider used when recovery succeeds.

## Observability

### Frontend

Log:

1. trigger mode used
2. display mode switch
3. retry count
4. visible-first translation timing

### Backend

Log:

1. provider chosen
2. latency
3. fallback path
4. error classification

Never log:

1. raw article text
2. API keys

## Testing Strategy

### TypeScript

1. Router decision tests
2. Reader mode rendering tests
3. Paragraph status machine tests
4. Selection translation popover behavior tests

### Rust

1. Provider request construction tests
2. Router fallback order tests
3. Keyring status/CRUD tests
4. Error mapping tests

### Verification Gates

1. `bun run test:run`
2. `cd src-tauri && cargo test`
3. `bun run check:all`
4. Rust-specific checks after command additions:
   - `cd src-tauri && cargo build --lib`
   - `bun run rust:bindings` (or existing binding generation flow)

## Delivery Slices

1. Slice A: Reader UI controls + bilingual/translated-only rendering
2. Slice B: Engine-first router + Apple fallback
3. Slice C: Provider management + keyring
4. Slice D: Selection translation + retries + observability polish

## Risks and Mitigations

1. Provider API divergence
   - Mitigation: strict adapter interfaces and normalized error contract
2. Language-pair support fragmentation
   - Mitigation: preflight capability checks + deterministic fallback chain
3. Cost drift with LLM fallback
   - Mitigation: engine-first default and per-provider enable toggles

