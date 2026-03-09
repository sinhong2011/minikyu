# LLM Code Language Detection — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Use LLM to detect code block languages when available, with regex fallback; simplify JS/TS picker options.

**Architecture:** New Tauri command `detect_code_language` reuses the summarize.rs LLM provider chain. Frontend calls it from CodeBlock component when `reader_code_detection_mode` is `auto` (default). Language picker groups JS/TS/JSX/TSX into one option.

**Tech Stack:** Rust (Tauri command), TypeScript (React), TanStack Query (preferences), Shiki (highlighting)

---

### Task 1: Add `reader_code_detection_mode` preference field

**Files:**
- Modify: `src-tauri/src/types.rs` (AppPreferences struct, ~line 165)

**Step 1: Add the field**

In `AppPreferences` struct, after `reader_code_theme`, add:

```rust
/// Code language detection mode: "auto" (LLM + regex fallback) or "regex" (regex only).
#[serde(default = "default_reader_code_detection_mode")]
pub reader_code_detection_mode: String,
```

Add the default function near the other defaults (~line 270):

```rust
fn default_reader_code_detection_mode() -> String {
    "auto".to_string()
}
```

**Step 2: Regenerate TypeScript bindings**

Run: `cd src-tauri && cargo build --lib && cd .. && bun run codegen:tauri`

Verify: `reader_code_detection_mode` appears in `src/lib/bindings.ts`

**Step 3: Update test setup default**

In `src/test/setup.ts`, add `reader_code_detection_mode: 'auto'` to the DEFAULT_PREFERENCES mock (search for `reader_code_theme`).

**Step 4: Commit**

```
feat(preferences): Add reader_code_detection_mode setting
```

---

### Task 2: Add `detect_code_language` Tauri command

**Files:**
- Modify: `src-tauri/src/commands/summarize.rs` (add new command after `summarize_article`)
- Modify: `src-tauri/src/bindings.rs` (register new command)

**Step 1: Add the command in summarize.rs**

After the `summarize_article` function (~line 278), add:

```rust
const CODE_DETECTION_PROMPT: &str = "\
You are a programming language identifier. \
Given a code snippet, respond with ONLY the programming language name in lowercase. \
For example: rust, python, javascript, typescript, c, cpp, go, java, etc. \
If you cannot identify the language, respond with: text \
Do not include any other text, explanation, or formatting.";

#[tauri::command]
#[specta::specta]
pub async fn detect_code_language(
    app: AppHandle,
    code: String,
) -> Result<String, String> {
    let code = code.trim();
    if code.is_empty() {
        return Ok("text".to_string());
    }

    // Truncate to save tokens
    let truncated = if code.len() > 500 { &code[..500] } else { code };

    let preferences = load_preferences_sync(&app).unwrap_or_default();
    let provider_settings = &preferences.reader_translation_provider_settings;

    // Use same provider resolution as summarize: dedicated summary provider → llm fallbacks → all LLMs
    let dedicated_provider = preferences
        .ai_summary_provider
        .as_deref()
        .map(str::trim)
        .filter(|p| !p.is_empty() && is_llm_provider(p));

    if let Some(provider) = dedicated_provider {
        let api_key = if provider == OLLAMA_PROVIDER {
            get_provider_key(provider).ok()
        } else {
            get_provider_key(provider).ok()
        };
        if api_key.is_some() || provider == OLLAMA_PROVIDER {
            let settings = provider_settings.get(provider);
            if let Ok(result) = call_llm(provider, truncated, CODE_DETECTION_PROMPT, api_key.as_deref(), settings).await {
                return Ok(result.trim().to_lowercase());
            }
        }
    }

    // Fallback through LLM chain
    let mut providers: Vec<String> = preferences
        .reader_translation_llm_fallbacks
        .iter()
        .filter(|p| is_llm_provider(p))
        .cloned()
        .collect();
    if providers.is_empty() {
        for &p in LLM_PROVIDERS {
            providers.push(p.to_string());
        }
    }

    for provider in &providers {
        if !has_runtime_settings(provider, provider_settings) {
            continue;
        }
        let api_key = if provider == OLLAMA_PROVIDER {
            get_provider_key(provider).ok()
        } else {
            match get_provider_key(provider) {
                Ok(key) => Some(key),
                Err(_) => continue,
            }
        };
        let settings = provider_settings.get(provider.as_str());
        if let Ok(result) = call_llm(provider, truncated, CODE_DETECTION_PROMPT, api_key.as_deref(), settings).await {
            return Ok(result.trim().to_lowercase());
        }
    }

    Err("No LLM provider available for code detection".to_string())
}
```

**Step 2: Register in bindings.rs**

Add to `collect_commands!` after `summarize::summarize_article_stream`:

```rust
summarize::detect_code_language,
```

**Step 3: Regenerate bindings**

Run: `cd src-tauri && cargo build --lib && cd .. && bun run codegen:tauri`

Verify: `detectCodeLanguage` appears in `src/lib/bindings.ts`

**Step 4: Commit**

```
feat(ai): Add detect_code_language Tauri command
```

---

### Task 3: Add frontend LLM detection function

**Files:**
- Modify: `src/lib/shiki-highlight.ts` (add async detection function)

**Step 1: Add the async LLM detection function**

At the end of `shiki-highlight.ts`, before the last export, add:

```typescript
import { commands } from '@/lib/tauri-bindings';

export async function detectCodeLanguageWithLLM(
  code: string,
): Promise<SupportedCodeLanguage> {
  try {
    const result = await commands.detectCodeLanguage(code.slice(0, 500));
    if (result.status === 'error') {
      return detectCodeLanguageFromContent(code);
    }
    const normalized = normalizeCodeLanguage(result.data);
    return normalized;
  } catch {
    return detectCodeLanguageFromContent(code);
  }
}
```

**Step 2: Commit**

```
feat(ai): Add frontend LLM code language detection
```

---

### Task 4: Integrate LLM detection into CodeBlock component

**Files:**
- Modify: `src/components/miniflux/SafeHtml.tsx` (CodeBlock component, ~line 142)

**Step 1: Import and wire up**

Add import at top of SafeHtml.tsx:

```typescript
import { detectCodeLanguageWithLLM } from '@/lib/shiki-highlight';
import { usePreferences } from '@/services/preferences';
```

**Step 2: Add LLM detection effect in CodeBlock**

In the CodeBlock component, after the existing `useEffect` that syncs `defaultLanguage` → `language` (line 161-163), add:

```typescript
const { data: preferences } = usePreferences();
const detectionMode = preferences?.reader_code_detection_mode ?? 'auto';

useEffect(() => {
  if (detectionMode !== 'auto') return;
  if (defaultLanguage !== 'text') return; // class-based detection already worked

  let cancelled = false;

  detectCodeLanguageWithLLM(text).then((detected) => {
    if (!cancelled && detected !== 'text') {
      setLanguage(detected);
    }
  });

  return () => { cancelled = true; };
}, [detectionMode, defaultLanguage, text]);
```

This only triggers LLM when:
1. Mode is `auto`
2. Class-based and regex detection both failed (returned `text`)

Wait — the user said "if user have llm, use llm not regex". So we should use LLM even when regex would succeed. Update the logic:

```typescript
useEffect(() => {
  if (detectionMode !== 'auto') return;

  let cancelled = false;

  detectCodeLanguageWithLLM(text).then((detected) => {
    if (!cancelled) {
      setLanguage(detected);
    }
  });

  return () => { cancelled = true; };
}, [detectionMode, text]);
```

But we should still use `defaultLanguage` initially (from class tokens) to avoid flash. The LLM result overrides once available. The existing `useEffect` for `defaultLanguage` handles initial state. The LLM effect fires async and overrides.

Actually, if a code block already has a class-based language (e.g., `class="language-python"`), skip LLM — the author already specified it. Only use LLM when class detection returned `text`:

```typescript
useEffect(() => {
  if (detectionMode !== 'auto') return;
  // If class-based detection found a language, trust it
  if (defaultLanguage !== 'text') return;

  let cancelled = false;

  detectCodeLanguageWithLLM(text).then((detected) => {
    if (!cancelled) {
      setLanguage(detected);
    }
  });

  return () => { cancelled = true; };
}, [detectionMode, defaultLanguage, text]);
```

Wait — `defaultLanguage` includes regex detection results too (via `detectCodeLanguageFromPre` which calls `detectCodeLanguageFromContent`). So when `defaultLanguage` is not `text`, either class or regex already got a result.

For "LLM over regex": We need to separate class-based detection from content detection. Modify `detectCodeLanguageFromPre` to NOT call `detectCodeLanguageFromContent` as fallback when LLM mode is active. Instead, return `text` and let the LLM effect handle it.

Better approach: Pass detection mode into the SafeHtml component. In the `detectCodeLanguageFromPre` function, skip the content-based fallback. Then in CodeBlock, if `defaultLanguage === 'text'` and mode is `auto`, call LLM.

Adjust `detectCodeLanguageFromPre`:

```typescript
function detectCodeLanguageFromPre(node: Element, skipContentDetection = false): SupportedCodeLanguage {
  const preClassLanguage = detectCodeLanguageFromClassTokens(getClassTokens(node));
  if (preClassLanguage !== 'text') return preClassLanguage;

  for (const child of node.children ?? []) {
    if (child.type === 'tag' && child.name === 'code') {
      const codeClassLanguage = detectCodeLanguageFromClassTokens(getClassTokens(child));
      if (codeClassLanguage !== 'text') return codeClassLanguage;
    }
  }

  if (skipContentDetection) return 'text';
  return detectCodeLanguageFromContent(getTextContent(node));
}
```

Then at the call site (~line 1489):

```typescript
const defaultLanguage = detectCodeLanguageFromPre(domNode, detectionMode === 'auto');
```

This way:
- `auto` mode: class tokens → if `text`, LLM takes over (with regex as LLM's internal fallback)
- `regex` mode: class tokens → content regex (existing behavior)

**Step 3: Commit**

```
feat(ai): Integrate LLM code detection into CodeBlock
```

---

### Task 5: Add detection mode to Reader preferences UI

**Files:**
- Modify: `src/components/preferences/panes/ReaderPane.tsx` (Code Blocks section, ~line 369)

**Step 1: Add the select**

Inside the `Code Blocks` SettingsSection (after the code theme select, ~line 391), add:

```tsx
<SettingsField
  label={_(msg`Language detection`)}
  description={_(msg`How code block languages are detected for syntax highlighting`)}
>
  <Select
    value={preferences?.reader_code_detection_mode ?? 'auto'}
    onValueChange={(value) => handleChange('reader_code_detection_mode', value)}
    disabled={!preferences || savePreferences.isPending}
  >
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="auto">{_(msg`Auto (LLM + regex)`)}</SelectItem>
      <SelectItem value="regex">{_(msg`Regex only`)}</SelectItem>
    </SelectContent>
  </Select>
</SettingsField>
```

**Step 2: Commit**

```
feat(preferences): Add code language detection mode setting
```

---

### Task 6: Simplify language picker — combine JS/TS variants

**Files:**
- Modify: `src/lib/shiki-highlight.ts` (codeLanguageOptions)
- Modify: `src/components/miniflux/SafeHtml.tsx` (CodeBlock select rendering)

**Step 1: Replace JS/TS variants with single option in codeLanguageOptions**

```typescript
export const codeLanguageOptions = [
  'text',
  'javascript/typescript',
  'json',
  'go',
  'c',
  'cpp',
  'html',
  'css',
  'bash',
  'python',
  'rust',
  'java',
  'kotlin',
  'swift',
  'sql',
  'yaml',
  'toml',
  'markdown',
] as const satisfies ReadonlyArray<SupportedCodeLanguage | 'javascript/typescript'>;
```

Wait — this breaks the type. Better approach: keep internal types as-is, only change the UI display. In the CodeBlock `<select>`:

```tsx
const PICKER_OPTIONS: { value: SupportedCodeLanguage; label: string }[] = [
  { value: 'text', label: 'text' },
  { value: 'javascript', label: 'JavaScript / TypeScript' },
  { value: 'json', label: 'json' },
  { value: 'go', label: 'go' },
  { value: 'c', label: 'c' },
  { value: 'cpp', label: 'cpp' },
  { value: 'html', label: 'html' },
  { value: 'css', label: 'css' },
  { value: 'bash', label: 'bash' },
  { value: 'python', label: 'python' },
  { value: 'rust', label: 'rust' },
  { value: 'java', label: 'java' },
  { value: 'kotlin', label: 'kotlin' },
  { value: 'swift', label: 'swift' },
  { value: 'sql', label: 'sql' },
  { value: 'yaml', label: 'yaml' },
  { value: 'toml', label: 'toml' },
  { value: 'markdown', label: 'markdown' },
];
```

When user selects "JavaScript / TypeScript" (value: `javascript`), the content-based detection refines to jsx/ts/tsx. Modify the select onChange:

```tsx
onChange={(event) => {
  const selected = normalizeCodeLanguage(event.target.value);
  if (selected === 'javascript') {
    // Auto-detect specific variant from content
    const refined = detectCodeLanguageFromContent(text);
    const jsFamily: SupportedCodeLanguage[] = ['javascript', 'typescript', 'jsx', 'tsx'];
    setLanguage(jsFamily.includes(refined) ? refined : 'javascript');
  } else {
    setLanguage(selected);
  }
}}
```

And map displayed value back: if current language is tsx/jsx/typescript, show "javascript" as selected:

```tsx
const pickerValue = ['typescript', 'tsx', 'jsx'].includes(language) ? 'javascript' : language;
```

**Step 2: Export PICKER_OPTIONS from shiki-highlight.ts**

Replace `codeLanguageOptions` with the new picker options array. Keep the internal types unchanged.

**Step 3: Commit**

```
feat(ui): Combine JS/TS variants in code language picker
```

---

### Task 7: Extract translations and verify

**Step 1: Extract i18n strings**

Run: `bun run i18n:extract`

**Step 2: Translate new strings**

Add translations for all 4 locales (ja, ko, zh-CN, zh-TW):
- "Language detection"
- "How code block languages are detected for syntax highlighting"
- "Auto (LLM + regex)"
- "Regex only"

**Step 3: Compile translations**

Run: `bun run i18n:compile`

**Step 4: Run checks**

Run: `bun run check:all`

**Step 5: Commit**

```
chore(i18n): Add translations for code detection settings
```

---

### Task 8: Run full test suite and verify

**Step 1: Run tests**

Run: `bun run test`

All tests should pass. Fix any failures.

**Step 2: Run type check**

Run: `bun run typecheck`

**Step 3: Verify app runs**

Run: `bun run dev`

Verify:
- Code blocks render with syntax highlighting
- Language picker shows combined JS/TS option
- Reader settings shows detection mode dropdown
- With LLM configured, code blocks without class annotations get LLM-detected language

**Step 4: Final commit if needed**

```
test: Verify LLM code detection integration
```
