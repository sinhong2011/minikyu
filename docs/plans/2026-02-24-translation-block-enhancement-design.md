# Translation Block Menu Enhancement Design

## Goal

Add translation provider info and re-translate options to the existing per-block dropdown menu in the immersive reader, so users can see which provider translated each block and retry with a different provider/model.

## Architecture

Enhance the existing `wrapReaderNodeBlock()` menu in `SafeHtml.tsx` with translation state awareness. The block menu already has "Phrase actions" and "Translation actions" sections. When a block has been translated, the Translation section expands to show provider info and re-translate options.

No visual changes to the reading view itself — all enhancements live inside the existing `···` dropdown menu.

## Menu Structure

### Translated block (success)

```
── Phrase actions ──
  Select phrase text          ⌥ S
  Copy phrase text            ⌘ C
── Translation ──
  ✓ deepl                     (or: openai · gpt-4o)
  Retry translation
  Translate with...         ▸
    ✓ DeepL
    Google Translate
    OpenAI · gpt-4o
    Ollama · llama3
    ...
  Copy translation
```

### Failed block

```
── Phrase actions ──
  Select phrase text          ⌥ S
  Copy phrase text            ⌘ C
── Translation ──
  ✗ Translation failed
  Retry translation
  Translate with...         ▸
    DeepL
    Google Translate
    ...
```

### Untranslated block (current behavior, unchanged)

```
── Phrase actions ──
  Select phrase text          ⌥ S
  Copy phrase text            ⌘ C
── Translation ──
  Translate paragraph
```

## Data Flow

1. `ImmersiveTranslationLayer` already tracks per-segment state (`SegmentState`) with `status`, `translatedText`, and `providerUsed`.
2. Pass segment state to `SafeHtml` via a new prop (map of segment index to state).
3. `wrapReaderNodeBlock` reads the segment state for the current block index to decide which menu items to show.
4. "Retry translation" calls existing retry handler (same provider chain).
5. "Translate with..." submenu items call a new handler that forces a specific provider, bypassing the normal fallback chain.
6. "Copy translation" copies `translatedText` from segment state to clipboard.

## Provider List for "Translate with..."

- Lists all providers that have `enabled: true` in preferences and have required configuration (API key, model for LLMs).
- For LLM providers, shows `ProviderName · model` format.
- The currently-used provider gets a `✓` checkmark prefix.
- Sourced from the same `TranslationRoutingPreferences` already passed to `ImmersiveTranslationLayer`.

## Backend Changes

- Add a `forced_provider` optional field to `TranslationSegmentRequest`. When set, skip the fallback chain and use only the specified provider.
- The existing `translate_reader_segment` command handles this by checking the field before building the provider chain.

## Components Modified

- `SafeHtml.tsx` — `wrapReaderNodeBlock()` menu gets translation-aware items
- `ImmersiveTranslationLayer.tsx` — pass segment states to SafeHtml, add `retryWithProvider()` handler
- `src-tauri/src/commands/translation.rs` — add `forced_provider` to request struct and routing logic
- `src-tauri/src/types.rs` — update `TranslationSegmentRequest` if needed
