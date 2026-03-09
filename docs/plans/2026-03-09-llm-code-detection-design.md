# LLM Code Language Detection

## Problem

Code blocks in RSS entries lack language annotations. The regex-based heuristic (`detectCodeLanguageFromContent`) works but is limited. Users with LLM providers configured can get better detection.

## Design

### Detection Modes

New preference: `reader_code_detection_mode`
- **`auto`** (default) — LLM if provider available, regex fallback on error/unavailable
- **`regex`** — Regex only, no LLM calls

### Flow

```
code block found
  → mode == "regex"? → regex detect → done
  → mode == "auto"?  → LLM available? → call detect_code_language command
                                         → success? → use LLM result
                                         → error?   → regex fallback
                     → no LLM?        → regex fallback
```

### Backend: `detect_code_language` Tauri Command

- Takes code snippet (truncated to ~500 chars on frontend to save tokens)
- Reuses `ai_summary_provider` → `llm_fallbacks` provider chain
- System prompt: "Identify the programming language of the following code. Reply with only the language name in lowercase, nothing else."
- Maps LLM response to `SupportedCodeLanguage` via `normalizeCodeLanguage`
- Returns language string or error

### Frontend Changes

- New async `detectCodeLanguageWithLLM(code: string): Promise<SupportedCodeLanguage>` in `shiki-highlight.ts`
- Calls Tauri command, normalizes result, falls back to regex on error
- Code highlighting pipeline calls this when mode is `auto` and LLM is available

### Language Picker Simplification

Combine JS/TS/JSX/TSX into single "JavaScript / TypeScript" option in manual picker UI. When selected, auto-detect specific variant via regex internally. Shiki languages and internal types unchanged.

### Preference Storage

Add to `AppPreferences`:
- Rust: `reader_code_detection_mode: String` (default: `"auto"`)
- TypeScript: same field on `AppPreferences` type

### UI

Add toggle in Reader settings pane alongside existing code theme picker:
- Label: "Code language detection"
- Options: "Auto (LLM + regex)" / "Regex only"
