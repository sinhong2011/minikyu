# Social Post Generation with Postiz Integration

## Overview

Generate AI-powered social media posts from articles and publish them directly to social platforms via the Postiz API. Accessible from the existing share popover in the article reader header toolbar.

## User Flow

1. User reads an article, clicks **Share** in the header toolbar
2. New **"Generate Social Post"** option in the share popover
3. Opens a **modal dialog** with:
   - Platform selector showing only platforms with connected Postiz integrations (X, LinkedIn, Facebook, Mastodon)
   - Custom prompt textarea (user's instructions for the AI, e.g., "make it witty with emojis")
   - Language selector (defaults to user's app language preference)
   - "Generate" button
4. AI generates platform-specific posts, displayed in **editable text areas** (one per platform)
5. User reviews/tweaks each post, clicks **"Send to Postiz"**
6. Posts sent via Postiz API with success/error toast notifications

## Backend Architecture

### New Module: `src-tauri/src/commands/social_post.rs`

#### Tauri Commands

| Command | Signature | Purpose |
|---------|-----------|---------|
| `generate_social_post` | `(title, url, content, platforms, custom_prompt, language) -> GenerateSocialPostResponse` | Calls LLM with article content + platforms + custom prompt, returns typed response with per-platform text |
| `fetch_postiz_integrations` | `() -> Vec<PostizIntegration>` | `GET /integrations` from Postiz API, returns connected social accounts with platform type |
| `send_to_postiz` | `(posts: Vec<PostizPost>) -> Result<(), String>` | `POST /posts` to Postiz API, sends generated posts |

**Note**: `generate_social_post` receives article content directly from the frontend (same pattern as `summarize_article` which receives `SummarizeArticleRequest { text, language }`). The Rust backend does not fetch entry content from the database.

All new commands must be registered in `collect_commands!` in `bindings.rs`, followed by `bun run codegen:tauri`.

#### Response Types

```rust
#[derive(Serialize, Deserialize, Type)]
pub struct GenerateSocialPostResponse {
    pub posts: Vec<PlatformPost>,
}

#[derive(Serialize, Deserialize, Type)]
pub struct PlatformPost {
    pub platform: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Type)]
pub struct PostizIntegration {
    pub id: String,
    pub name: String,
    pub platform: String, // "x", "linkedin", "facebook", "mastodon"
}
```

#### Credential Storage (keyring)

- LLM API key: Reuses existing per-provider keyring keys from `reader_translation_provider_settings` (same pattern as summarization — `minikyu:translation:{provider}:{profile}`)
- `minikyu:postiz:api-key` — Postiz API key (new)

#### LLM Prompt Strategy

- Input: article title, URL, trimmed plain-text excerpt (~2000 chars, HTML stripped by frontend before sending)
- User's custom prompt appended as additional instructions
- Language parameter included (e.g., "Generate posts in Japanese")
- Platform-specific formatting rules included in system prompt:
  - **X**: 280 char limit, hashtags encouraged
  - **LinkedIn**: Professional tone, longer form allowed
  - **Facebook**: Conversational, medium length
  - **Mastodon**: 500 char limit, hashtags
- Single LLM call with JSON mode enabled (OpenAI `response_format`, Anthropic tool use, etc.) for reliable structured output
- If JSON parsing fails: retry once, then return error with raw LLM text so user can manually extract content

#### Postiz API Integration

- Base URL: `https://api.postiz.com/public/v1` (configurable for self-hosted)
- Auth: `Authorization: Bearer {apiKey}` header
- Rate limit: 30 requests/hour
- Post payload structure:
  ```json
  {
    "type": "now",
    "posts": [
      {
        "integration": { "id": "integration-id" },
        "value": [{ "content": "generated text" }],
        "settings": { "__type": "platform-key" }
      }
    ]
  }
  ```

## Frontend Architecture

### Modified Files

- `EntryReadingHeader.tsx` — add "Generate Social Post" option to share popover

### New Files

| File | Purpose |
|------|---------|
| `src/components/miniflux/SocialPostDialog.tsx` | Modal: platform selector (filtered by available Postiz integrations), custom prompt, editable post editors, send button |
| `src/services/miniflux/social-post.ts` | React Query hooks for generate, fetch integrations, send |

### Platform-to-Integration Mapping

The dialog fetches Postiz integrations on open via `fetch_postiz_integrations`. The platform selector only shows platforms that have at least one connected Postiz integration. Each platform option displays the integration name (e.g., "X - @myhandle"). When sending, the frontend maps the selected platform to its corresponding `integration.id`.

If a user selects a platform with multiple integrations (e.g., two X accounts), show a sub-selector for which account to post from.

### Preferences Additions (AppPreferences)

| Field | Type | Purpose |
|-------|------|---------|
| `social_post_provider` | `Option<String>` | LLM provider name (openai, anthropic, etc.) |
| `social_post_model` | `Option<String>` | Model name |
| `postiz_base_url` | `Option<String>` | Postiz API URL (default: cloud). Syncs to cloud (not device-specific). |
| `postiz_self_hosted` | `bool` | Toggle for self-hosted Postiz. Syncs to cloud. |

LLM base URL is not needed — reuses `reader_translation_provider_settings` per-provider config (same as summarization).

### Settings UI

New section in PreferencesDialog: **"Social Posting"** group with:
- LLM provider dropdown + model input (reuses existing provider infrastructure)
- Postiz API key field + base URL + self-hosted toggle
- "Test Connection" button for Postiz

### Platforms (Initial)

X, LinkedIn, Facebook, Mastodon. More can be added later (Postiz supports 32).

## Error Handling

| Scenario | Handling |
|----------|----------|
| No LLM provider configured | Inline message in dialog: "Configure a social post provider in Settings" |
| No Postiz API key | Inline message in dialog: "Configure Postiz in Settings" |
| LLM generation fails | Error toast, text areas stay empty, retry available |
| LLM returns malformed JSON | Retry once with JSON mode; if still fails, show error with option to retry |
| Postiz API error | Error toast with message, modal stays open for retry or copy |
| Postiz rate limit (30/hr) | Specific "Rate limit exceeded" toast |
| No Postiz integrations | Message: "No connected accounts found in Postiz. Connect accounts in Postiz first." |
| Selected platform has no integration | Platform not shown in selector (filtered out) |
| Article content too long | Trim to ~2000 chars plain text, always include title + URL |
| Network offline | Standard reqwest error as toast |

## No Database Changes

Generated posts are ephemeral — shown in modal, sent to Postiz, not cached locally.

## i18n

All user-facing strings in `SocialPostDialog.tsx` and Settings UI must use `msg` macro + `useLingui`. Run `bun run i18n:extract` after implementation.

## Dependencies

- No new Rust crates needed (reqwest and serde already available)
- No new npm packages needed
