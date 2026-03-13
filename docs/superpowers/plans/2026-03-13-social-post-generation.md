# Social Post Generation with Postiz Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate AI social media posts from articles and publish them to social platforms via Postiz API.

**Architecture:** New Rust command module (`social_post.rs`) follows the summarization pattern — LLM provider resolution, keyring-based API keys, typed request/response structs. Frontend adds a new option to the existing share popover that opens a modal dialog for generation, editing, and sending.

**Tech Stack:** Rust (reqwest, serde, keyring), React (shadcn/ui Dialog, TanStack Query), Tauri v2 (specta bindings), Lingui (i18n)

**Spec:** `docs/superpowers/specs/2026-03-13-social-post-generation-design.md`

---

## Chunk 1: Rust Backend — Types, Preferences, and Postiz Client

### Task 1: Add social post preference fields to AppPreferences

**Files:**
- Modify: `src-tauri/src/types.rs` (AppPreferences struct, around line 257)

- [ ] **Step 1: Add new fields to AppPreferences**

Add after the `ai_summary_max_text_length` field block (~line 257):

```rust
/// Preferred LLM provider for social post generation (e.g. "openai", "anthropic").
/// If None, uses translation LLM fallback chain (same as summarization).
#[serde(default)]
pub social_post_provider: Option<String>,

/// Preferred model for social post generation.
/// If None, uses the model from provider settings.
#[serde(default)]
pub social_post_model: Option<String>,

/// Postiz API base URL. Defaults to cloud: https://api.postiz.com/public/v1
#[serde(default)]
pub postiz_base_url: Option<String>,

/// Whether Postiz is self-hosted (affects base URL usage).
#[serde(default)]
pub postiz_self_hosted: bool,
```

- [ ] **Step 2: Verify Rust compilation**

Run: `cd src-tauri && cargo build --lib`
Expected: Compiles successfully (all new fields have `#[serde(default)]`)

- [ ] **Step 3: Regenerate TypeScript bindings**

Run: `bun run codegen:tauri`
Expected: `src/lib/bindings.ts` updated with new `social_post_provider`, `social_post_model`, `postiz_base_url`, `postiz_self_hosted` fields on `AppPreferences` type.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/types.rs src/lib/bindings.ts
git commit -m "feat(social-post): Add social post and Postiz preference fields"
```

---

### Task 2: Create social_post command module with types

**Files:**
- Create: `src-tauri/src/commands/social_post.rs`
- Modify: `src-tauri/src/commands/mod.rs` (add `pub mod social_post;`)
- Modify: `src-tauri/src/bindings.rs` (register commands)

- [ ] **Step 1: Create the module with request/response types**

Create `src-tauri/src/commands/social_post.rs`:

```rust
//! Social post generation and Postiz integration commands.
//!
//! Generates AI-powered social media posts from article content
//! and publishes them via the Postiz API.

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::AppHandle;

/// Supported social media platforms for post generation.
const PLATFORM_RULES: &[(&str, &str)] = &[
    ("x", "Maximum 280 characters. Use hashtags. Be concise and punchy."),
    ("linkedin", "Professional tone. Can be longer (up to 3000 chars). Use line breaks for readability."),
    ("facebook", "Conversational tone. Medium length. Encourage engagement."),
    ("mastodon", "Maximum 500 characters. Use hashtags. Similar to Twitter but more relaxed."),
];

const DEFAULT_POSTIZ_BASE_URL: &str = "https://api.postiz.com/public/v1";

// ── Request / Response types ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct GenerateSocialPostRequest {
    pub title: String,
    pub url: String,
    pub content: String,
    pub platforms: Vec<String>,
    pub custom_prompt: Option<String>,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct GenerateSocialPostResponse {
    pub posts: Vec<PlatformPost>,
    pub provider_used: String,
    pub model_used: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PlatformPost {
    pub platform: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PostizIntegration {
    pub id: String,
    pub name: String,
    pub platform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PostizPostRequest {
    pub integration_id: String,
    pub platform: String,
    pub content: String,
}
```

- [ ] **Step 2: Register module in mod.rs**

Add to `src-tauri/src/commands/mod.rs`:
```rust
pub mod social_post;
```

- [ ] **Step 3: Verify compilation**

Run: `cd src-tauri && cargo build --lib`
Expected: Compiles (no commands registered yet, just types)

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/social_post.rs src-tauri/src/commands/mod.rs
git commit -m "feat(social-post): Add social post module with request/response types"
```

---

### Task 3: Implement generate_social_post command

**Files:**
- Modify: `src-tauri/src/commands/social_post.rs`
- Modify: `src-tauri/src/bindings.rs`

Reference: `src-tauri/src/commands/summarize.rs` lines 145-278 for provider resolution pattern, lines 325-337 for keyring access, lines 404-673 for LLM call functions.

- [ ] **Step 1: Add LLM provider resolution and call logic**

Add to `social_post.rs` after the types:

```rust
use crate::commands::preferences::load_preferences_sync;
use crate::commands::summarize::{
    call_anthropic, call_gemini, call_ollama, call_openai_compatible,
    get_provider_key, LLM_PROVIDERS,
};

/// Build the system prompt for social post generation.
fn build_system_prompt(platforms: &[String], custom_prompt: &Option<String>, language: &Option<String>) -> String {
    let mut prompt = String::from(
        "You are a social media content creator. Generate engaging posts for the following platforms based on the article provided.\n\n"
    );

    for platform in platforms {
        if let Some((_, rules)) = PLATFORM_RULES.iter().find(|(p, _)| *p == platform.as_str()) {
            prompt.push_str(&format!("**{platform}**: {rules}\n"));
        }
    }

    if let Some(lang) = language {
        prompt.push_str(&format!("\nGenerate all posts in {lang}.\n"));
    }

    if let Some(custom) = custom_prompt {
        if !custom.trim().is_empty() {
            prompt.push_str(&format!("\nAdditional instructions: {custom}\n"));
        }
    }

    prompt.push_str(&format!(
        "\nRespond with valid JSON only. Format:\n{}\n",
        r#"{"posts": [{"platform": "x", "content": "..."}, {"platform": "linkedin", "content": "..."}]}"#
    ));

    prompt
}

/// Build the user message with article content.
fn build_user_message(title: &str, url: &str, content: &str) -> String {
    // Trim content to ~2000 chars
    let trimmed = if content.len() > 2000 {
        &content[..content.char_indices().take_while(|(i, _)| *i < 2000).last().map(|(i, c)| i + c.len_utf8()).unwrap_or(2000)]
    } else {
        content
    };

    format!("Article title: {title}\nURL: {url}\n\nArticle excerpt:\n{trimmed}")
}

/// Resolve which LLM provider and model to use.
fn resolve_provider(app: &AppHandle) -> Result<(String, String, String), String> {
    let prefs = load_preferences_sync(app).unwrap_or_default();

    // 1. Check dedicated social post provider
    if let Some(ref provider) = prefs.social_post_provider {
        if !provider.is_empty() {
            let key = get_provider_key(provider)?;
            let model = prefs.social_post_model
                .or_else(|| prefs.reader_translation_provider_settings.get(provider).and_then(|s| s.model.clone()))
                .unwrap_or_default();
            return Ok((provider.clone(), model, key));
        }
    }

    // 2. Fall back to translation LLM fallback chain (same as summarize)
    for provider in &prefs.reader_translation_llm_fallbacks {
        if let Ok(key) = get_provider_key(provider) {
            let model = prefs.reader_translation_provider_settings.get(provider)
                .and_then(|s| s.model.clone())
                .unwrap_or_default();
            return Ok((provider.clone(), model, key));
        }
    }

    // 3. Try all LLM providers
    for provider in LLM_PROVIDERS {
        if let Ok(key) = get_provider_key(provider) {
            let model = prefs.reader_translation_provider_settings.get(*provider)
                .and_then(|s| s.model.clone())
                .unwrap_or_default();
            return Ok((provider.to_string(), model, key));
        }
    }

    Err("No LLM provider configured. Set up a provider in Settings → Translation or Settings → Social Posting.".to_string())
}

/// Generate social media posts from an article using AI.
#[tauri::command]
#[specta::specta]
pub async fn generate_social_post(
    app: AppHandle,
    request: GenerateSocialPostRequest,
) -> Result<GenerateSocialPostResponse, String> {
    log::info!("Generating social posts for platforms: {:?}", request.platforms);

    let (provider, model, api_key) = resolve_provider(&app)?;
    let prefs = load_preferences_sync(&app).unwrap_or_default();
    let provider_settings = prefs.reader_translation_provider_settings.get(&provider).cloned();

    let system_prompt = build_system_prompt(&request.platforms, &request.custom_prompt, &request.language);
    let user_message = build_user_message(&request.title, &request.url, &request.content);

    let base_url = provider_settings.as_ref().and_then(|s| s.base_url.clone());

    let raw_response = match provider.as_str() {
        "anthropic" => call_anthropic(&api_key, &model, &system_prompt, &user_message).await?,
        "gemini" => call_gemini(&api_key, &model, &system_prompt, &user_message).await?,
        "ollama" => call_ollama(base_url.as_deref(), &model, &system_prompt, &user_message).await?,
        _ => call_openai_compatible(&provider, &api_key, base_url.as_deref(), &model, &system_prompt, &user_message).await?,
    };

    // Parse JSON response
    let parsed = parse_llm_response(&raw_response, &request.platforms)?;

    Ok(GenerateSocialPostResponse {
        posts: parsed,
        provider_used: provider,
        model_used: model,
    })
}

/// Parse LLM response JSON into platform posts.
/// Extracts JSON from markdown code fences if present.
fn parse_llm_response(raw: &str, platforms: &[String]) -> Result<Vec<PlatformPost>, String> {
    // Strip markdown code fences if present
    let json_str = if let Some(start) = raw.find('{') {
        if let Some(end) = raw.rfind('}') {
            &raw[start..=end]
        } else {
            raw
        }
    } else {
        raw
    };

    #[derive(Deserialize)]
    struct LlmResponse {
        posts: Vec<LlmPost>,
    }
    #[derive(Deserialize)]
    struct LlmPost {
        platform: String,
        content: String,
    }

    let parsed: LlmResponse = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse AI response as JSON: {e}. Raw response: {raw}"))?;

    // Filter to only requested platforms
    let posts: Vec<PlatformPost> = parsed.posts
        .into_iter()
        .filter(|p| platforms.contains(&p.platform))
        .map(|p| PlatformPost { platform: p.platform, content: p.content })
        .collect();

    if posts.is_empty() {
        return Err(format!("AI did not generate posts for any requested platform. Raw response: {raw}"));
    }

    Ok(posts)
}
```

- [ ] **Step 2: Ensure summarize.rs exports are accessible**

Check that `call_openai_compatible`, `call_anthropic`, `call_gemini`, `call_ollama`, `get_provider_key`, and `LLM_PROVIDERS` are `pub(crate)` in `summarize.rs`. If they are private, change their visibility to `pub(crate)`.

- [ ] **Step 3: Register command in bindings.rs**

Add to the `collect_commands!` macro in `src-tauri/src/bindings.rs`:
```rust
social_post::generate_social_post,
```

- [ ] **Step 4: Verify compilation**

Run: `cd src-tauri && cargo build --lib`
Expected: Compiles successfully

- [ ] **Step 5: Regenerate TypeScript bindings**

Run: `bun run codegen:tauri`
Expected: `generateSocialPost` command appears in `src/lib/bindings.ts`

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/social_post.rs src-tauri/src/commands/summarize.rs src-tauri/src/bindings.rs src/lib/bindings.ts
git commit -m "feat(social-post): Implement generate_social_post command with LLM integration"
```

---

### Task 4: Implement Postiz API client commands

**Files:**
- Modify: `src-tauri/src/commands/social_post.rs`
- Modify: `src-tauri/src/bindings.rs`

- [ ] **Step 1: Add Postiz keyring helper and fetch_postiz_integrations command**

Add to `social_post.rs`:

```rust
use keyring::Entry;

const KEYRING_SERVICE_NAME: &str = "minikyu";
const POSTIZ_KEYRING_KEY: &str = "minikyu:postiz:api-key";

fn get_postiz_credentials(app: &AppHandle) -> Result<(String, String), String> {
    let entry = Entry::new(KEYRING_SERVICE_NAME, POSTIZ_KEYRING_KEY)
        .map_err(|e| format!("Failed to access keyring for Postiz: {e}"))?;
    let api_key = entry.get_password()
        .map_err(|_| "Postiz API key not configured. Set it in Settings → Social Posting.".to_string())?;

    if api_key.trim().is_empty() {
        return Err("Postiz API key is empty. Set it in Settings → Social Posting.".to_string());
    }

    let prefs = load_preferences_sync(app).unwrap_or_default();
    let base_url = prefs.postiz_base_url
        .filter(|u| !u.is_empty())
        .unwrap_or_else(|| DEFAULT_POSTIZ_BASE_URL.to_string());

    Ok((api_key, base_url))
}

/// Fetch connected social media integrations from Postiz.
#[tauri::command]
#[specta::specta]
pub async fn fetch_postiz_integrations(
    app: AppHandle,
) -> Result<Vec<PostizIntegration>, String> {
    log::info!("Fetching Postiz integrations");
    let (api_key, base_url) = get_postiz_credentials(&app)?;

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{base_url}/integrations"))
        .header("Authorization", format!("Bearer {api_key}"))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Postiz: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Postiz API error ({status}): {body}"));
    }

    #[derive(Deserialize)]
    struct ApiIntegration {
        id: String,
        name: Option<String>,
        #[serde(rename = "providerIdentifier")]
        provider_identifier: Option<String>,
        provider: Option<String>,
    }

    let integrations: Vec<ApiIntegration> = response.json().await
        .map_err(|e| format!("Failed to parse Postiz integrations: {e}"))?;

    let result: Vec<PostizIntegration> = integrations
        .into_iter()
        .map(|i| PostizIntegration {
            id: i.id,
            name: i.name.unwrap_or_else(|| "Unnamed".to_string()),
            platform: i.provider_identifier.or(i.provider).unwrap_or_default(),
        })
        .collect();

    log::info!("Found {} Postiz integrations", result.len());
    Ok(result)
}
```

- [ ] **Step 2: Add send_to_postiz command**

```rust
/// Send generated posts to Postiz for publishing.
#[tauri::command]
#[specta::specta]
pub async fn send_to_postiz(
    app: AppHandle,
    posts: Vec<PostizPostRequest>,
) -> Result<(), String> {
    log::info!("Sending {} posts to Postiz", posts.len());
    let (api_key, base_url) = get_postiz_credentials(&app)?;

    let postiz_posts: Vec<serde_json::Value> = posts
        .iter()
        .map(|p| serde_json::json!({
            "integration": { "id": p.integration_id },
            "value": [{ "content": p.content }],
            "settings": { "__type": p.platform }
        }))
        .collect();

    let payload = serde_json::json!({
        "type": "now",
        "posts": postiz_posts
    });

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{base_url}/posts"))
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send to Postiz: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();

        if status.as_u16() == 429 {
            return Err("Postiz rate limit exceeded (30 requests/hour). Try again later.".to_string());
        }
        return Err(format!("Postiz API error ({status}): {body}"));
    }

    log::info!("Successfully sent posts to Postiz");
    Ok(())
}
```

- [ ] **Step 3: Add keyring save/delete commands for Postiz API key**

```rust
/// Save Postiz API key to the system keyring.
#[tauri::command]
#[specta::specta]
pub fn save_postiz_api_key(api_key: String) -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE_NAME, POSTIZ_KEYRING_KEY)
        .map_err(|e| format!("Failed to access keyring: {e}"))?;
    entry.set_password(&api_key)
        .map_err(|e| format!("Failed to save Postiz API key: {e}"))?;
    log::info!("Postiz API key saved to keyring");
    Ok(())
}

/// Delete Postiz API key from the system keyring.
#[tauri::command]
#[specta::specta]
pub fn delete_postiz_api_key() -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE_NAME, POSTIZ_KEYRING_KEY)
        .map_err(|e| format!("Failed to access keyring: {e}"))?;
    entry.delete_credential()
        .map_err(|e| format!("Failed to delete Postiz API key: {e}"))?;
    log::info!("Postiz API key deleted from keyring");
    Ok(())
}

/// Check if a Postiz API key is stored in the keyring.
#[tauri::command]
#[specta::specta]
pub fn has_postiz_api_key() -> Result<bool, String> {
    let entry = Entry::new(KEYRING_SERVICE_NAME, POSTIZ_KEYRING_KEY)
        .map_err(|e| format!("Failed to access keyring: {e}"))?;
    Ok(entry.get_password().is_ok())
}
```

- [ ] **Step 4: Register all new commands in bindings.rs**

Add to `collect_commands!`:
```rust
social_post::fetch_postiz_integrations,
social_post::send_to_postiz,
social_post::save_postiz_api_key,
social_post::delete_postiz_api_key,
social_post::has_postiz_api_key,
```

- [ ] **Step 5: Verify compilation**

Run: `cd src-tauri && cargo build --lib`
Expected: Compiles successfully

- [ ] **Step 6: Regenerate TypeScript bindings**

Run: `bun run codegen:tauri`
Expected: All 5 new commands appear in `src/lib/bindings.ts`

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/social_post.rs src-tauri/src/bindings.rs src/lib/bindings.ts
git commit -m "feat(social-post): Implement Postiz API client commands"
```

---

## Chunk 2: Frontend — Service Layer, Dialog, and Integration

### Task 5: Create React Query service hooks

**Files:**
- Create: `src/services/miniflux/social-post.ts`

- [ ] **Step 1: Create the service file**

```typescript
import { commands } from '@/lib/tauri-bindings';
import { useMutation, useQuery } from '@tanstack/react-query';

/**
 * Fetch connected Postiz integrations (social accounts).
 * Enabled only when the dialog is open.
 */
export function usePostizIntegrations(enabled: boolean) {
  return useQuery({
    queryKey: ['postiz-integrations'],
    queryFn: async () => {
      const result = await commands.fetchPostizIntegrations();
      if (result.status === 'error') throw new Error(result.error);
      return result.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });
}

/**
 * Generate social media posts from article content using AI.
 */
export function useGenerateSocialPost() {
  return useMutation({
    mutationFn: async (request: {
      title: string;
      url: string;
      content: string;
      platforms: string[];
      // biome-ignore lint/style/useNamingConvention: Tauri binding field name
      custom_prompt: string | null;
      language: string | null;
    }) => {
      const result = await commands.generateSocialPost(request);
      if (result.status === 'error') throw new Error(result.error);
      return result.data;
    },
  });
}

/**
 * Send generated posts to Postiz for publishing.
 */
export function useSendToPostiz() {
  return useMutation({
    mutationFn: async (posts: Array<{
      // biome-ignore lint/style/useNamingConvention: Tauri binding field name
      integration_id: string;
      platform: string;
      content: string;
    }>) => {
      const result = await commands.sendToPostiz(posts);
      if (result.status === 'error') throw new Error(result.error);
      return result.data;
    },
  });
}

/**
 * Check if Postiz API key is configured.
 */
export function useHasPostizApiKey(enabled: boolean) {
  return useQuery({
    queryKey: ['postiz-api-key-check'],
    queryFn: async () => {
      const result = await commands.hasPostizApiKey();
      if (result.status === 'error') return false;
      return result.data;
    },
    enabled,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/miniflux/social-post.ts
git commit -m "feat(social-post): Add React Query service hooks for social post generation"
```

---

### Task 6: Create SocialPostDialog component

**Files:**
- Create: `src/components/miniflux/SocialPostDialog.tsx`

Reference: `src/components/miniflux/ArticleSummary.tsx` for AI interaction pattern, `src/components/miniflux/EntryReadingHeader.tsx` lines 876-950 for share popover button styling.

- [ ] **Step 1: Create the dialog component**

```typescript
import { useCallback, useEffect, useState } from 'react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { showToast } from '@/lib/toast';
import {
  usePostizIntegrations,
  useGenerateSocialPost,
  useSendToPostiz,
  useHasPostizApiKey,
} from '@/services/miniflux/social-post';
import type { Entry } from '@/lib/bindings';

// Platform display names
const PLATFORM_LABELS: Record<string, string> = {
  x: 'X (Twitter)',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  mastodon: 'Mastodon',
};

// Supported platforms for generation
const SUPPORTED_PLATFORMS = ['x', 'linkedin', 'facebook', 'mastodon'];

interface SocialPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: Entry;
  articleText: string;
}

export function SocialPostDialog({ open, onOpenChange, entry, articleText }: SocialPostDialogProps) {
  const { _ } = useLingui();
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [editedPosts, setEditedPosts] = useState<Record<string, string>>({});
  const [integrationMap, setIntegrationMap] = useState<Record<string, string>>({});

  const hasApiKey = useHasPostizApiKey(open);
  const integrations = usePostizIntegrations(open && (hasApiKey.data === true));
  const generateMutation = useGenerateSocialPost();
  const sendMutation = useSendToPostiz();

  // Map integrations to available platforms
  const availablePlatforms = integrations.data
    ? [...new Set(integrations.data
        .filter(i => SUPPORTED_PLATFORMS.includes(i.platform))
        .map(i => i.platform))]
    : [];

  // Build integration ID lookup (platform -> first matching integration ID)
  useEffect(() => {
    if (integrations.data) {
      const map: Record<string, string> = {};
      for (const integration of integrations.data) {
        if (SUPPORTED_PLATFORMS.includes(integration.platform) && !map[integration.platform]) {
          map[integration.platform] = integration.id;
        }
      }
      setIntegrationMap(map);
    }
  }, [integrations.data]);

  const handlePlatformToggle = useCallback((platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (selectedPlatforms.length === 0) return;

    try {
      const result = await generateMutation.mutateAsync({
        title: entry.title,
        url: entry.url,
        content: articleText,
        platforms: selectedPlatforms,
        custom_prompt: customPrompt || null,
        language: null,
      });

      const posts: Record<string, string> = {};
      for (const post of result.posts) {
        posts[post.platform] = post.content;
      }
      setEditedPosts(posts);
    } catch (error) {
      showToast.error(_(msg`Failed to generate social posts`), String(error));
    }
  }, [selectedPlatforms, entry, articleText, customPrompt, generateMutation, _]);

  const handleSend = useCallback(async () => {
    const postsToSend = Object.entries(editedPosts)
      .filter(([platform]) => integrationMap[platform])
      .map(([platform, content]) => ({
        integration_id: integrationMap[platform],
        platform,
        content,
      }));

    if (postsToSend.length === 0) return;

    try {
      await sendMutation.mutateAsync(postsToSend);
      showToast.success(_(msg`Posts sent to Postiz successfully`));
      onOpenChange(false);
    } catch (error) {
      showToast.error(_(msg`Failed to send to Postiz`), String(error));
    }
  }, [editedPosts, integrationMap, sendMutation, onOpenChange, _]);

  const handlePostEdit = useCallback((platform: string, content: string) => {
    setEditedPosts(prev => ({ ...prev, [platform]: content }));
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedPlatforms([]);
      setCustomPrompt('');
      setEditedPosts({});
    }
  }, [open]);

  const hasGenerated = Object.keys(editedPosts).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{_(msg`Generate Social Post`)}</DialogTitle>
        </DialogHeader>

        {hasApiKey.data === false && (
          <p className="text-sm text-muted-foreground">
            {_(msg`Configure Postiz API key in Settings to use this feature.`)}
          </p>
        )}

        {hasApiKey.data === true && integrations.isLoading && (
          <p className="text-sm text-muted-foreground">{_(msg`Loading connected accounts...`)}</p>
        )}

        {hasApiKey.data === true && integrations.isError && (
          <p className="text-sm text-destructive">
            {_(msg`Failed to fetch Postiz accounts.`)} {String(integrations.error)}
          </p>
        )}

        {hasApiKey.data === true && integrations.isSuccess && availablePlatforms.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {_(msg`No connected accounts found in Postiz. Connect accounts in Postiz first.`)}
          </p>
        )}

        {hasApiKey.data === true && availablePlatforms.length > 0 && (
          <div className="space-y-4">
            {/* Platform selector */}
            <div>
              <Label className="text-sm font-medium">{_(msg`Platforms`)}</Label>
              <div className="flex flex-wrap gap-3 mt-2">
                {availablePlatforms.map(platform => (
                  <label key={platform} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedPlatforms.includes(platform)}
                      onCheckedChange={() => handlePlatformToggle(platform)}
                    />
                    <span className="text-sm">{PLATFORM_LABELS[platform] ?? platform}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom prompt */}
            <div>
              <Label className="text-sm font-medium">{_(msg`Custom instructions`)}</Label>
              <Textarea
                className="mt-1.5"
                placeholder={_(msg`e.g., "make it witty with emojis" or "focus on the technical aspects"`)}
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                rows={2}
              />
            </div>

            {/* Generate button */}
            {!hasGenerated && (
              <Button
                onClick={handleGenerate}
                disabled={selectedPlatforms.length === 0 || generateMutation.isPending}
              >
                {generateMutation.isPending ? _(msg`Generating...`) : _(msg`Generate`)}
              </Button>
            )}

            {/* Editable post areas */}
            {hasGenerated && (
              <div className="space-y-4">
                {selectedPlatforms.map(platform => (
                  <div key={platform}>
                    <Label className="text-sm font-medium">
                      {PLATFORM_LABELS[platform] ?? platform}
                    </Label>
                    <Textarea
                      className="mt-1.5 font-mono text-sm"
                      value={editedPosts[platform] ?? ''}
                      onChange={e => handlePostEdit(platform, e.target.value)}
                      rows={4}
                    />
                  </div>
                ))}

                <div className="flex gap-2">
                  <Button
                    onClick={handleSend}
                    disabled={sendMutation.isPending}
                  >
                    {sendMutation.isPending ? _(msg`Sending...`) : _(msg`Send to Postiz`)}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleGenerate}
                    disabled={generateMutation.isPending}
                  >
                    {_(msg`Regenerate`)}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/miniflux/SocialPostDialog.tsx
git commit -m "feat(social-post): Create SocialPostDialog component"
```

---

### Task 7: Add "Generate Social Post" to share popover

**Files:**
- Modify: `src/components/miniflux/EntryReadingHeader.tsx`

- [ ] **Step 1: Add state and import for the dialog**

At top of file, add import:
```typescript
import { SocialPostDialog } from './SocialPostDialog';
```

Add state in the component (near other state declarations):
```typescript
const [socialPostDialogOpen, setSocialPostDialogOpen] = useState(false);
```

- [ ] **Step 2: Add share popover button**

In the share popover (after the "Save to Services" button, ~line 948), add:

```tsx
{/* Generate Social Post */}
<button
  type="button"
  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-black/[0.06] dark:hover:bg-white/10 cursor-pointer"
  onClick={() => {
    setSocialPostDialogOpen(true);
  }}
>
  <Share01Icon className="size-4 shrink-0 opacity-70" />
  <span>{_(msg`Generate Social Post`)}</span>
</button>
```

Note: Use an appropriate icon from the existing icon set. Check what's available — `Share01Icon` or a similar icon that's already imported. If a more specific icon exists (e.g., a megaphone or sparkle), use that instead.

- [ ] **Step 3: Render the dialog**

Add the dialog component near the bottom of the JSX return, outside the popover but inside the fragment:

```tsx
<SocialPostDialog
  open={socialPostDialogOpen}
  onOpenChange={setSocialPostDialogOpen}
  entry={entry}
  articleText={articleText}
/>
```

The `articleText` prop needs to be the plain text content of the article. Check how the component accesses article content — it may need to be extracted from `entry.content` (HTML → plain text). If a `stripHtml` utility exists in the codebase, use it. Otherwise, create a simple one:

```typescript
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent ?? '';
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/miniflux/EntryReadingHeader.tsx
git commit -m "feat(social-post): Add Generate Social Post option to share popover"
```

---

### Task 8: Add Postiz settings to PreferencesDialog

**Files:**
- Modify: `src/components/preferences/panes/` — either add to an existing pane or create a new pane file

Reference: `src/components/preferences/panes/TranslationPane.tsx` for LLM provider settings pattern.

- [ ] **Step 1: Create SocialPostPane component**

Create `src/components/preferences/panes/SocialPostPane.tsx` following the pattern in TranslationPane.tsx:

- Section 1: "Social Post AI Provider"
  - Provider dropdown (same provider list as translation: openai, anthropic, gemini, etc.)
  - Model input field
  - Uses existing `save_translation_provider_key` command for API key (shared keyring)
- Section 2: "Postiz Integration"
  - API key input (uses `save_postiz_api_key` / `delete_postiz_api_key` commands)
  - Base URL input (shown when self-hosted toggle is on)
  - Self-hosted toggle
  - "Test Connection" button that calls `fetch_postiz_integrations` and shows count

Use `usePreferences()` and `useSavePreferences()` for preference fields. Use the Lingui `msg` macro for all labels.

- [ ] **Step 2: Register the pane in PreferencesDialog**

Add the new pane to the preferences dialog navigation. Check `src/components/preferences/PreferencesDialog.tsx` for how panes are registered and add a "Social Posting" entry.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/preferences/panes/SocialPostPane.tsx src/components/preferences/PreferencesDialog.tsx
git commit -m "feat(social-post): Add Social Posting settings pane"
```

---

### Task 9: Extract i18n strings and compile translations

**Files:**
- Modify: `src/locales/en/messages.po`
- Modify: `src/locales/ja/messages.po`
- Modify: `src/locales/ko/messages.po`
- Modify: `src/locales/zh-CN/messages.po`
- Modify: `src/locales/zh-TW/messages.po`

- [ ] **Step 1: Extract new strings**

Run: `bun run i18n:extract`
Expected: New strings appear as untranslated in all locale `.po` files

- [ ] **Step 2: Translate strings**

Translate all new strings in ja, ko, zh-CN, zh-TW locale files. Key strings to translate:
- "Generate Social Post"
- "Platforms"
- "Custom instructions"
- "Generate" / "Generating..."
- "Send to Postiz" / "Sending..."
- "Regenerate"
- "Posts sent to Postiz successfully"
- "Failed to generate social posts"
- "Failed to send to Postiz"
- "Configure Postiz API key in Settings to use this feature."
- "Loading connected accounts..."
- "No connected accounts found in Postiz. Connect accounts in Postiz first."
- Settings pane labels

- [ ] **Step 3: Compile translations**

Run: `bun run i18n:compile`
Expected: Compiled message files updated

- [ ] **Step 4: Commit**

```bash
git add src/locales/
git commit -m "feat(social-post): Add i18n translations for social post feature"
```

---

## Chunk 3: Verification and Quality Gates

### Task 10: Run quality checks and verify app

- [ ] **Step 1: Run full quality gate**

Run: `bun run check:all`
Expected: All checks pass (typecheck, clippy, cargo test, cargo fmt, biome)

- [ ] **Step 2: Fix any issues found**

Address any lint, type, or formatting errors.

- [ ] **Step 3: Verify app runs**

Run: `bun run dev`
Expected:
- App launches without errors
- Share popover shows "Generate Social Post" option
- Clicking it opens the dialog
- Settings → Social Posting pane is accessible

- [ ] **Step 4: Final commit if needed**

```bash
git add -A
git commit -m "fix(social-post): Address quality gate feedback"
```

- [ ] **Step 5: Create PR**

```bash
git push -u origin feature/social-post-generation
gh pr create --title "feat: AI social post generation with Postiz integration" --body "..."
```
