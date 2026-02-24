# LLM Provider Custom Prompt Field & Default Prompt Optimization

**Date:** 2026-02-20
**Status:** Approved

## Problem

1. `ReaderTranslationProviderSettings` has no `system_prompt` field, making it impossible for users to customize the LLM translation instruction.
2. The current default prompt (`build_ollama_translation_prompt`) is too generic — "You are a translation engine" — and lacks nuance, cultural sensitivity guidance, and clear output constraints.

## Goals

- Add a per-provider optional `system_prompt` field that, when set, overrides the default.
- Optimize the hardcoded default prompt to be more professional and effective.
- Support `{source_lang}` and `{target_lang}` placeholders (replaced with language codes at runtime).

## Approach: Per-Provider Custom Prompt

Extend `ReaderTranslationProviderSettings` with an optional `system_prompt`. The existing struct is already keyed per-provider in a `HashMap`, making this a natural fit. Different LLM providers may require different instruction styles, so per-provider granularity is preferred over a single global prompt.

## Design

### Rust — `src-tauri/src/types.rs`

Add `system_prompt: Option<String>` to `ReaderTranslationProviderSettings`:

```rust
pub struct ReaderTranslationProviderSettings {
    pub enabled: bool,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub timeout_ms: Option<u32>,
    pub system_prompt: Option<String>,  // NEW
}
```

Validation in `validate_reader_translation_provider_settings`:
- Max length: 2,048 characters
- No other constraints (any non-empty string is valid)

### Rust — `src-tauri/src/commands/translation.rs`

**New constant — optimized default prompt:**

```rust
const DEFAULT_LLM_TRANSLATION_PROMPT: &str = "\
You are a professional {source_lang} to {target_lang} translator. \
Accurately convey the meaning and nuances of the original text while \
adhering to {target_lang} grammar, vocabulary, and cultural sensitivities. \
Produce only the {target_lang} translation, without any additional \
explanations or commentary.";
```

**New helper — `resolve_llm_system_prompt`:**

```rust
fn resolve_llm_system_prompt(
    request: &TranslationSegmentRequest,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> String {
    let template = settings
        .and_then(|s| s.system_prompt.as_deref())
        .filter(|p| !p.trim().is_empty())
        .unwrap_or(DEFAULT_LLM_TRANSLATION_PROMPT);

    let source = request
        .source_language
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("auto");

    template
        .replace("{source_lang}", source)
        .replace("{target_lang}", &request.target_language)
}
```

**Replace `build_ollama_translation_prompt`:**

The existing `build_ollama_translation_prompt` is deleted. `translate_with_ollama` calls `resolve_llm_system_prompt(request, settings)` instead.

### Variable Placeholders

| Placeholder | Replaced with |
|-------------|---------------|
| `{source_lang}` | `source_language` from request, or `"auto"` if empty/None |
| `{target_lang}` | `target_language` from request |

Language codes are used directly (e.g. `en`, `zh-HK`), no name mapping.

### Frontend — Preferences UI

In the translation provider settings section (per-provider panel):
- Add a textarea for `system_prompt`
- Placeholder text: the default prompt text so users see what they're overriding
- Helper text: "Supports `{source_lang}` and `{target_lang}` placeholders. Leave empty to use the default."
- Bound to `reader_translation_provider_settings[provider].system_prompt`

### TypeScript Bindings

`system_prompt?: string | null` will be generated automatically via tauri-specta after the Rust struct is updated and `bun run codegen:tauri` is run.

## Default Prompt — Before / After

**Before:**
```
You are a translation engine. Translate the user text from {source} to {target}.
Return only the translated text and preserve original formatting and line breaks.
```

**After:**
```
You are a professional {source_lang} to {target_lang} translator.
Accurately convey the meaning and nuances of the original text while
adhering to {target_lang} grammar, vocabulary, and cultural sensitivities.
Produce only the {target_lang} translation, without any additional
explanations or commentary.
```

Key improvements:
- "professional translator" sets a higher quality expectation than "translation engine"
- "nuances" and "cultural sensitivities" guide LLMs to produce more natural output
- "without any additional explanations or commentary" is more precise than "return only"
- Removed "preserve original formatting and line breaks" — covered implicitly; avoids over-constraining

## Testing

- Unit tests for `resolve_llm_system_prompt`:
  - No settings → uses default prompt with substituted vars
  - Empty `system_prompt` → uses default prompt
  - Custom `system_prompt` → uses custom with substituted vars
  - `{source_lang}` with None source → substitutes "auto"
- Validation tests for `system_prompt` length limit (2,048 chars)
- Ollama integration path: verifies correct system message is sent

## Out of Scope

- Implementing other LLM providers (openai, anthropic, etc.) — separate task
- Language code → display name mapping
- Global fallback prompt (YAGNI)
