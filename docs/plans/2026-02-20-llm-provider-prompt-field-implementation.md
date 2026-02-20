# LLM Provider Custom Prompt Field Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an optional `system_prompt` field to per-provider settings and replace the hardcoded Ollama prompt with a shared, optimized default.

**Architecture:** Extend `ReaderTranslationProviderSettings` (Rust struct) with `system_prompt: Option<String>`, add a `resolve_llm_system_prompt` helper that applies variable substitution, update validation, regenerate TypeScript bindings, and add a textarea to the LLM provider settings panel.

**Tech Stack:** Rust (types.rs, translation.rs), tauri-specta codegen, React/TypeScript (TranslationPane.tsx), Lingui i18n

---

### Task 1: Add `system_prompt` field to Rust struct + validation

**Files:**
- Modify: `src-tauri/src/types.rs:84-95` (struct definition)
- Modify: `src-tauri/src/types.rs:432-530` (validation function)
- Test: `src-tauri/src/types.rs` (inline test module already exists at end of file)

**Step 1: Read the current struct and validation code**

Read `src-tauri/src/types.rs` lines 84–530 to understand exact context.

**Step 2: Write failing tests**

At the end of the existing test module in `types.rs`, add:

```rust
#[test]
fn validate_provider_settings_rejects_empty_system_prompt() {
    let mut provider_settings = HashMap::new();
    provider_settings.insert(
        "openai".to_string(),
        ReaderTranslationProviderSettings {
            enabled: true,
            base_url: None,
            model: Some("gpt-4o".to_string()),
            timeout_ms: None,
            system_prompt: Some("".to_string()),
        },
    );
    let result = validate_reader_translation_provider_settings(&provider_settings);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("system_prompt"));
}

#[test]
fn validate_provider_settings_rejects_system_prompt_too_long() {
    let mut provider_settings = HashMap::new();
    provider_settings.insert(
        "openai".to_string(),
        ReaderTranslationProviderSettings {
            enabled: true,
            base_url: None,
            model: Some("gpt-4o".to_string()),
            timeout_ms: None,
            system_prompt: Some("x".repeat(2049)),
        },
    );
    let result = validate_reader_translation_provider_settings(&provider_settings);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("system_prompt"));
}

#[test]
fn validate_provider_settings_accepts_valid_system_prompt() {
    let mut provider_settings = HashMap::new();
    provider_settings.insert(
        "openai".to_string(),
        ReaderTranslationProviderSettings {
            enabled: true,
            base_url: None,
            model: Some("gpt-4o".to_string()),
            timeout_ms: None,
            system_prompt: Some("You are a translator.".to_string()),
        },
    );
    let result = validate_reader_translation_provider_settings(&provider_settings);
    assert!(result.is_ok());
}

#[test]
fn validate_provider_settings_accepts_none_system_prompt() {
    let mut provider_settings = HashMap::new();
    provider_settings.insert(
        "openai".to_string(),
        ReaderTranslationProviderSettings {
            enabled: true,
            base_url: None,
            model: Some("gpt-4o".to_string()),
            timeout_ms: None,
            system_prompt: None,
        },
    );
    let result = validate_reader_translation_provider_settings(&provider_settings);
    assert!(result.is_ok());
}
```

**Step 3: Run tests to verify they fail**

```bash
cd .worktrees/codex-immersive-reader-translation && cargo test -p minikyu-lib validate_provider_settings 2>&1 | head -40
```

Expected: compilation error — `system_prompt` field doesn't exist yet.

**Step 4: Add `system_prompt` to the struct**

In `src-tauri/src/types.rs`, modify the struct (lines 84–95):

```rust
/// Runtime settings for one translation provider.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default, PartialEq, Eq, Hash)]
pub struct ReaderTranslationProviderSettings {
    /// Whether this provider is allowed to be used.
    pub enabled: bool,
    /// Optional provider base URL override.
    pub base_url: Option<String>,
    /// Optional model override. Required for LLM providers.
    pub model: Option<String>,
    /// Optional timeout in milliseconds.
    pub timeout_ms: Option<u32>,
    /// Optional system prompt override for LLM providers.
    /// Supports {source_lang} and {target_lang} placeholders.
    pub system_prompt: Option<String>,
}
```

**Step 5: Add validation in `validate_reader_translation_provider_settings`**

After the existing `model` validation block (around line 490), add:

```rust
const MAX_PROVIDER_SYSTEM_PROMPT_LENGTH: usize = 2_048;

if let Some(system_prompt) = &settings.system_prompt {
    let prompt_trimmed = system_prompt.trim();
    if prompt_trimmed.is_empty() {
        return Err(format!(
            "reader_translation_provider_settings[{provider_id_trimmed}].system_prompt cannot be empty when set"
        ));
    }
    if prompt_trimmed.chars().count() > MAX_PROVIDER_SYSTEM_PROMPT_LENGTH {
        return Err(format!(
            "reader_translation_provider_settings[{provider_id_trimmed}].system_prompt too long (max {MAX_PROVIDER_SYSTEM_PROMPT_LENGTH} characters)"
        ));
    }
}
```

Note: declare the constant inside the function alongside the others already there.

**Step 6: Run tests to verify they pass**

```bash
cd .worktrees/codex-immersive-reader-translation && cargo test -p minikyu-lib validate_provider_settings 2>&1
```

Expected: 4 tests pass.

**Step 7: Compile to check no other breakage**

```bash
cd .worktrees/codex-immersive-reader-translation/src-tauri && cargo build --lib 2>&1 | grep -E "^error"
```

Expected: no errors.

**Step 8: Commit**

```bash
cd .worktrees/codex-immersive-reader-translation
git add src-tauri/src/types.rs
git commit -m "feat(translation): Add system_prompt field to ReaderTranslationProviderSettings"
```

---

### Task 2: Replace `build_ollama_translation_prompt` with `resolve_llm_system_prompt`

**Files:**
- Modify: `src-tauri/src/commands/translation.rs:718-729` (remove old fn, add new fn + constant)
- Test: `src-tauri/src/commands/translation.test.rs`

**Step 1: Read the test file**

Read `src-tauri/src/commands/translation.test.rs` to understand the test patterns.

**Step 2: Write failing tests**

Add to `translation.test.rs`:

```rust
#[cfg(test)]
mod resolve_llm_system_prompt_tests {
    use super::*;
    use crate::types::ReaderTranslationProviderSettings;

    fn make_request(source: Option<&str>, target: &str) -> TranslationSegmentRequest {
        TranslationSegmentRequest {
            text: "Hello".to_string(),
            source_language: source.map(str::to_string),
            target_language: target.to_string(),
            route_mode: "engine_first".to_string(),
            primary_engine: None,
            engine_fallbacks: vec![],
            llm_fallbacks: vec![],
            apple_fallback_enabled: false,
        }
    }

    #[test]
    fn uses_default_prompt_when_no_settings() {
        let request = make_request(Some("en"), "zh-HK");
        let result = resolve_llm_system_prompt(&request, None);
        assert!(result.contains("en"));
        assert!(result.contains("zh-HK"));
        assert!(!result.contains("{source_lang}"));
        assert!(!result.contains("{target_lang}"));
    }

    #[test]
    fn uses_default_prompt_when_system_prompt_is_none() {
        let settings = ReaderTranslationProviderSettings {
            enabled: true,
            base_url: None,
            model: Some("gpt-4o".to_string()),
            timeout_ms: None,
            system_prompt: None,
        };
        let request = make_request(Some("en"), "zh-HK");
        let result = resolve_llm_system_prompt(&request, Some(&settings));
        assert!(result.contains("en"));
        assert!(result.contains("zh-HK"));
        assert!(!result.contains("{source_lang}"));
    }

    #[test]
    fn uses_default_prompt_when_system_prompt_is_empty() {
        let settings = ReaderTranslationProviderSettings {
            enabled: true,
            base_url: None,
            model: Some("gpt-4o".to_string()),
            timeout_ms: None,
            system_prompt: Some("   ".to_string()),
        };
        let request = make_request(Some("en"), "zh-HK");
        let result = resolve_llm_system_prompt(&request, Some(&settings));
        // Should fall back to default (contains "professional" from the default prompt)
        assert!(result.contains("professional"));
    }

    #[test]
    fn uses_custom_prompt_with_substitution() {
        let settings = ReaderTranslationProviderSettings {
            enabled: true,
            base_url: None,
            model: Some("gpt-4o".to_string()),
            timeout_ms: None,
            system_prompt: Some("Translate from {source_lang} to {target_lang}.".to_string()),
        };
        let request = make_request(Some("en"), "zh-HK");
        let result = resolve_llm_system_prompt(&request, Some(&settings));
        assert_eq!(result, "Translate from en to zh-HK.");
    }

    #[test]
    fn substitutes_auto_when_source_language_is_none() {
        let request = make_request(None, "zh-HK");
        let result = resolve_llm_system_prompt(&request, None);
        assert!(result.contains("auto"));
        assert!(!result.contains("{source_lang}"));
    }

    #[test]
    fn substitutes_auto_when_source_language_is_empty() {
        let request = make_request(Some("  "), "zh-HK");
        let result = resolve_llm_system_prompt(&request, None);
        assert!(result.contains("auto"));
    }
}
```

**Step 3: Run tests to verify they fail**

```bash
cd .worktrees/codex-immersive-reader-translation && cargo test -p minikyu-lib resolve_llm_system_prompt 2>&1 | head -20
```

Expected: compilation error — `resolve_llm_system_prompt` not defined yet.

**Step 4: Add constant and new function; remove old function**

In `src-tauri/src/commands/translation.rs`:

1. Add constant near the other `const` declarations at the top of the file (around line 32):

```rust
const DEFAULT_LLM_TRANSLATION_PROMPT: &str = "\
You are a professional {source_lang} to {target_lang} translator. \
Accurately convey the meaning and nuances of the original text while \
adhering to {target_lang} grammar, vocabulary, and cultural sensitivities. \
Produce only the {target_lang} translation, without any additional \
explanations or commentary.";
```

2. Replace the `build_ollama_translation_prompt` function (lines 718–729) with `resolve_llm_system_prompt`:

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

3. In `translate_with_ollama` (around line 885–898), replace the `build_ollama_translation_prompt(request)` call:

```rust
// Before:
"content": build_ollama_translation_prompt(request),

// After:
"content": resolve_llm_system_prompt(request, settings),
```

**Step 5: Run tests to verify they pass**

```bash
cd .worktrees/codex-immersive-reader-translation && cargo test -p minikyu-lib resolve_llm_system_prompt 2>&1
```

Expected: 6 tests pass.

**Step 6: Full test suite**

```bash
cd .worktrees/codex-immersive-reader-translation && cargo test -p minikyu-lib 2>&1 | tail -10
```

Expected: all tests pass.

**Step 7: Commit**

```bash
cd .worktrees/codex-immersive-reader-translation
git add src-tauri/src/commands/translation.rs src-tauri/src/commands/translation.test.rs
git commit -m "feat(translation): Replace hardcoded Ollama prompt with shared resolve_llm_system_prompt"
```

---

### Task 3: Regenerate TypeScript bindings

**Files:**
- Auto-generated: `src/lib/tauri-bindings.ts`

**Step 1: Run codegen**

```bash
cd .worktrees/codex-immersive-reader-translation && bun run codegen:tauri 2>&1
```

Expected: success, no errors.

**Step 2: Verify `system_prompt` appears in bindings**

```bash
grep "system_prompt" .worktrees/codex-immersive-reader-translation/src/lib/tauri-bindings.ts
```

Expected: line like `system_prompt: string | null` inside `ReaderTranslationProviderSettings`.

**Step 3: Commit**

```bash
cd .worktrees/codex-immersive-reader-translation
git add src/lib/tauri-bindings.ts
git commit -m "chore: Regenerate TypeScript bindings for system_prompt field"
```

---

### Task 4: Update TypeScript UI state and save handler

**Files:**
- Modify: `src/components/preferences/panes/TranslationPane.tsx:246-260` (ProviderRuntimeInputState + toRuntimeInputState)
- Modify: `src/components/preferences/panes/TranslationPane.tsx:572-586` (getProviderRuntimeSettings)
- Modify: `src/components/preferences/panes/TranslationPane.tsx:844-878` (handleProviderRuntimeBlur)

**Step 1: Read TranslationPane.tsx lines 246–260 and 572–586 and 844–878**

Confirm exact line numbers before editing.

**Step 2: Extend `ProviderRuntimeInputState`**

```typescript
// Before:
type ProviderRuntimeInputState = {
  baseUrl: string;
  model: string;
  timeoutMs: string;
};

// After:
type ProviderRuntimeInputState = {
  baseUrl: string;
  model: string;
  timeoutMs: string;
  systemPrompt: string;
};
```

**Step 3: Extend `toRuntimeInputState`**

```typescript
// Before:
function toRuntimeInputState(
  settings: ReaderTranslationProviderSettings | undefined
): ProviderRuntimeInputState {
  return {
    baseUrl: settings?.base_url ?? '',
    model: settings?.model ?? '',
    timeoutMs: settings?.timeout_ms ? String(settings.timeout_ms) : '',
  };
}

// After:
function toRuntimeInputState(
  settings: ReaderTranslationProviderSettings | undefined
): ProviderRuntimeInputState {
  return {
    baseUrl: settings?.base_url ?? '',
    model: settings?.model ?? '',
    timeoutMs: settings?.timeout_ms ? String(settings.timeout_ms) : '',
    systemPrompt: settings?.system_prompt ?? '',
  };
}
```

**Step 4: Extend `getProviderRuntimeSettings`**

```typescript
// Before:
return {
  enabled: existingSettings?.enabled ?? fallbackEnabled,
  base_url: existingSettings?.base_url ?? null,
  model: existingSettings?.model ?? null,
  timeout_ms: existingSettings?.timeout_ms ?? null,
};

// After:
return {
  enabled: existingSettings?.enabled ?? fallbackEnabled,
  base_url: existingSettings?.base_url ?? null,
  model: existingSettings?.model ?? null,
  timeout_ms: existingSettings?.timeout_ms ?? null,
  system_prompt: existingSettings?.system_prompt ?? null,
};
```

**Step 5: Extend `handleProviderRuntimeBlur` to save `system_prompt`**

Inside the `saveProviderRuntimeSettings` call, add `system_prompt`:

```typescript
// Before:
await saveProviderRuntimeSettings(provider, {
  base_url: input.baseUrl.trim().length > 0 ? input.baseUrl.trim() : null,
  model: input.model.trim().length > 0 ? input.model.trim() : null,
  timeout_ms: parsedTimeout === null ? null : Math.round(parsedTimeout),
});

// After:
await saveProviderRuntimeSettings(provider, {
  // biome-ignore lint/style/useNamingConvention: backend preference field name
  base_url: input.baseUrl.trim().length > 0 ? input.baseUrl.trim() : null,
  model: input.model.trim().length > 0 ? input.model.trim() : null,
  // biome-ignore lint/style/useNamingConvention: backend preference field name
  timeout_ms: parsedTimeout === null ? null : Math.round(parsedTimeout),
  // biome-ignore lint/style/useNamingConvention: backend preference field name
  system_prompt: input.systemPrompt.trim().length > 0 ? input.systemPrompt.trim() : null,
});
```

**Step 6: TypeScript compile check**

```bash
cd .worktrees/codex-immersive-reader-translation && bun run typecheck 2>&1 | head -30
```

Expected: no errors.

**Step 7: Commit**

```bash
cd .worktrees/codex-immersive-reader-translation
git add src/components/preferences/panes/TranslationPane.tsx
git commit -m "feat(translation): Wire system_prompt into provider runtime state and save handler"
```

---

### Task 5: Add system prompt textarea to the UI (LLM providers only)

**Files:**
- Modify: `src/components/preferences/panes/TranslationPane.tsx` (UI section, around lines 1234–1260)

The system prompt textarea is added after the model input row, only visible when `selectedProvider.kind === 'llm'`.

**Step 1: Add `Textarea` import**

At the top of TranslationPane.tsx, add:

```typescript
import { Textarea } from '@/components/ui/textarea';
```

**Step 2: Add the textarea row after the model input (after line ~1259)**

```tsx
{selectedProvider.kind === 'llm' && (
  <SettingsRow
    label={_(msg`${selectedProviderDisplay.providerName} system prompt`)}
    htmlFor={`provider-system-prompt-${selectedProvider.id}`}
    description={_(msg`Override the default translation instruction. Supports {source_lang} and {target_lang} placeholders.`)}
  >
    <Textarea
      id={`provider-system-prompt-${selectedProvider.id}`}
      aria-label={_(msg`${selectedProviderDisplay.providerName} system prompt`)}
      value={selectedProviderDisplay.runtimeInput.systemPrompt}
      rows={4}
      onChange={(event) =>
        setProviderRuntimeInputs((previous) => ({
          ...previous,
          [selectedProvider.id]: {
            ...(previous[selectedProvider.id] ??
              toRuntimeInputState(selectedProviderDisplay.runtimeSettings)),
            systemPrompt: event.target.value,
          },
        }))
      }
      onBlur={() => {
        void handleProviderRuntimeBlur(selectedProvider);
      }}
      placeholder={_(msg`Leave empty to use default prompt`)}
    />
  </SettingsRow>
)}
```

**Step 3: Check if `Textarea` UI component exists**

```bash
ls .worktrees/codex-immersive-reader-translation/src/components/ui/textarea* 2>/dev/null || echo "MISSING"
```

If missing, create it by following the same pattern as `src/components/ui/input.tsx`. Typical shadcn textarea:

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
```

**Step 4: TypeScript compile check**

```bash
cd .worktrees/codex-immersive-reader-translation && bun run typecheck 2>&1 | head -30
```

Expected: no errors.

**Step 5: Biome lint check**

```bash
cd .worktrees/codex-immersive-reader-translation && bun run check 2>&1 | head -30
```

Fix any lint issues.

**Step 6: Commit**

```bash
cd .worktrees/codex-immersive-reader-translation
git add src/components/preferences/panes/TranslationPane.tsx src/components/ui/textarea.tsx
git commit -m "feat(translation): Add system prompt textarea to LLM provider settings panel"
```

---

### Task 6: i18n extraction and compilation

**Files:**
- Auto-updated: `src/locales/*/messages.po`
- Auto-compiled: `src/locales/*/messages.ts`

**Step 1: Extract new translation strings**

```bash
cd .worktrees/codex-immersive-reader-translation && bun run i18n:extract 2>&1
```

Expected: success, new msgid entries appear in `src/locales/en/messages.po`.

**Step 2: Compile messages**

```bash
cd .worktrees/codex-immersive-reader-translation && bun run i18n:compile 2>&1
```

Expected: success.

**Step 3: Final check:all**

```bash
cd .worktrees/codex-immersive-reader-translation && bun run check:all 2>&1 | tail -20
```

Expected: all checks pass.

**Step 4: Commit**

```bash
cd .worktrees/codex-immersive-reader-translation
git add src/locales/
git commit -m "chore(i18n): Extract and compile new translation strings for system prompt UI"
```

---

## Summary

| Task | Files Changed | Tests |
|------|--------------|-------|
| 1 | `src-tauri/src/types.rs` | 4 unit tests |
| 2 | `src-tauri/src/commands/translation.rs`, `translation.test.rs` | 6 unit tests |
| 3 | `src/lib/tauri-bindings.ts` (auto-generated) | — |
| 4 | `TranslationPane.tsx` (state + handler) | TypeScript compile |
| 5 | `TranslationPane.tsx` (UI) + `textarea.tsx` | TypeScript compile + biome |
| 6 | `src/locales/**` | `check:all` |
