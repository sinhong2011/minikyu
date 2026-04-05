use chrono::Utc;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::Row;
use std::collections::HashMap;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::preferences::load_preferences_sync;
use crate::utils::str_utils::truncate_str;
use crate::types::ReaderTranslationProviderSettings;
use crate::utils::llm_stream;

const KEYRING_SERVICE_NAME: &str = "minikyu";
const TRANSLATION_KEYRING_KEY_PREFIX: &str = "minikyu:translation";
const DEFAULT_TRANSLATION_PROFILE: &str = "default";

const OLLAMA_PROVIDER: &str = "ollama";
const ANTHROPIC_PROVIDER: &str = "anthropic";
const OPENAI_DEFAULT_BASE_URL: &str = "https://api.openai.com";
const ANTHROPIC_DEFAULT_BASE_URL: &str = "https://api.anthropic.com";
const GEMINI_DEFAULT_BASE_URL: &str = "https://generativelanguage.googleapis.com";
const OPENROUTER_DEFAULT_BASE_URL: &str = "https://openrouter.ai";
const GLM_DEFAULT_BASE_URL: &str = "https://open.bigmodel.cn/api/paas/v4";
const KIMI_DEFAULT_BASE_URL: &str = "https://api.moonshot.cn";
const MINIMAX_DEFAULT_BASE_URL: &str = "https://api.minimax.io";
const QWEN_DEFAULT_BASE_URL: &str = "https://dashscope.aliyuncs.com/compatible-mode";
const DEEPSEEK_DEFAULT_BASE_URL: &str = "https://api.deepseek.com";
const OLLAMA_DEFAULT_BASE_URL: &str = "http://localhost:11434";

const DEFAULT_SUMMARIZE_TIMEOUT_MS: u32 = 30_000;
const LLM_PROVIDERS: &[&str] = &[
    "openai",
    "anthropic",
    "gemini",
    "openrouter",
    "glm",
    "kimi",
    "minimax",
    "qwen",
    "deepseek",
    "ollama",
];

const DEFAULT_SUMMARY_PROMPT: &str = "\
You are a concise article summarizer. \
Summarize the following article in 3-5 bullet points (max 250 words total). \
Each bullet point should be 1-2 sentences. \
Capture the key ideas and main takeaways. \
Use clear, direct language. \
Output only the summary bullet points, nothing else.";

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SummarizeArticleRequest {
    pub text: String,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SummarizeArticleResponse {
    pub summary: String,
    pub provider_used: String,
    pub model_used: String,
}

// ── Response types ──

#[derive(Debug, Deserialize)]
struct OpenAiChatCompletionsResponse {
    choices: Option<Vec<OpenAiChatChoice>>,
    error: Option<OpenAiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChatChoice {
    message: Option<OpenAiChatMessage>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChatMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiErrorBody {
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicMessagesResponse {
    content: Option<Vec<AnthropicContentBlock>>,
    error: Option<AnthropicErrorBody>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContentBlock {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicErrorBody {
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiGenerateContentResponse {
    candidates: Option<Vec<GeminiCandidate>>,
    error: Option<GeminiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContent>,
}

#[derive(Debug, Deserialize)]
struct GeminiContent {
    parts: Option<Vec<GeminiPart>>,
}

#[derive(Debug, Deserialize)]
struct GeminiPart {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiErrorBody {
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    message: Option<OllamaChatMessage>,
    response: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaChatMessage {
    content: String,
}

// ── Tauri command ──

#[tauri::command]
#[specta::specta]
pub async fn summarize_article(
    app: AppHandle,
    request: SummarizeArticleRequest,
) -> Result<SummarizeArticleResponse, String> {
    let preferences = load_preferences_sync(&app).unwrap_or_default();
    let max_len = preferences.ai_summary_max_text_length as usize;

    let text = request.text.trim();
    if text.is_empty() {
        return Err("Article text is empty".to_string());
    }
    let text = truncate_str(text, max_len);

    let provider_settings = &preferences.reader_translation_provider_settings;
    let system_prompt = build_summary_prompt(
        request.language.as_deref(),
        preferences.ai_summary_custom_prompt.as_deref(),
    );

    // If a dedicated summary provider is configured, use it directly
    let dedicated_provider = preferences
        .ai_summary_provider
        .as_deref()
        .map(str::trim)
        .filter(|p| !p.is_empty() && is_llm_provider(p));
    let model_override = preferences
        .ai_summary_model
        .as_deref()
        .map(str::trim)
        .filter(|m| !m.is_empty());

    if let Some(provider) = dedicated_provider {
        let api_key = if provider == OLLAMA_PROVIDER {
            get_provider_key(provider).ok()
        } else {
            match get_provider_key(provider) {
                Ok(key) => Some(key),
                Err(e) => return Err(format!("API key not found for {provider}: {e}")),
            }
        };

        let base_settings = provider_settings.get(provider);
        let overridden_settings;
        let effective_settings = if let Some(model_name) = model_override {
            overridden_settings = ReaderTranslationProviderSettings {
                enabled: true,
                model: Some(model_name.to_string()),
                base_url: base_settings.and_then(|s| s.base_url.clone()),
                timeout_ms: base_settings.and_then(|s| s.timeout_ms),
                system_prompt: base_settings.and_then(|s| s.system_prompt.clone()),
            };
            Some(&overridden_settings)
        } else {
            base_settings
        };

        let model = model_override
            .map(|m| m.to_string())
            .unwrap_or_else(|| get_model_name(effective_settings));

        return call_llm(
            provider,
            text,
            &system_prompt,
            api_key.as_deref(),
            effective_settings,
        )
        .await
        .map(|summary| SummarizeArticleResponse {
            summary,
            provider_used: provider.to_string(),
            model_used: model,
        })
        .map_err(|e| format!("Summary failed: {provider}: {e}"));
    }

    // Fallback: iterate through translation LLM provider chain
    let mut providers: Vec<String> = Vec::new();
    for provider_id in &preferences.reader_translation_llm_fallbacks {
        if is_llm_provider(provider_id) {
            providers.push(provider_id.clone());
        }
    }
    if providers.is_empty() {
        for &provider_id in LLM_PROVIDERS {
            providers.push(provider_id.to_string());
        }
    }
    if providers.is_empty() {
        return Err("No LLM provider configured. Set up an LLM provider in AI Summary or Translation settings.".to_string());
    }

    let mut errors: Vec<String> = Vec::new();
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
        let model = get_model_name(settings);
        let result = call_llm(provider, text, &system_prompt, api_key.as_deref(), settings).await;
        match result {
            Ok(summary) => {
                return Ok(SummarizeArticleResponse {
                    summary,
                    provider_used: provider.clone(),
                    model_used: model,
                });
            }
            Err(e) => {
                errors.push(format!("{provider}: {e}"));
            }
        }
    }

    if errors.is_empty() {
        Err("No LLM provider available. Configure an LLM provider with an API key and model in AI Summary or Translation settings.".to_string())
    } else {
        Err(format!("Summary failed: {}", errors.join(" | ")))
    }
}

// ── Helpers ──

fn is_llm_provider(provider: &str) -> bool {
    LLM_PROVIDERS.contains(&provider)
}

fn get_model_name(settings: Option<&ReaderTranslationProviderSettings>) -> String {
    settings
        .and_then(|s| s.model.as_deref())
        .map(str::trim)
        .filter(|m| !m.is_empty())
        .unwrap_or("unknown")
        .to_string()
}

fn build_summary_prompt(language: Option<&str>, custom_prompt: Option<&str>) -> String {
    let base = custom_prompt
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(DEFAULT_SUMMARY_PROMPT);
    match language {
        Some(lang) if !lang.trim().is_empty() => {
            format!("{base}\n\nWrite the summary in {lang}.")
        }
        _ => base.to_string(),
    }
}

fn has_runtime_settings(
    provider: &str,
    settings: &HashMap<String, ReaderTranslationProviderSettings>,
) -> bool {
    let Some(s) = settings.get(provider) else {
        return false;
    };
    if !s.enabled {
        return false;
    }
    // LLM providers must have a model configured
    s.model
        .as_deref()
        .map(str::trim)
        .is_some_and(|m| !m.is_empty())
}

fn get_provider_key(provider: &str) -> Result<String, String> {
    let keyring_key =
        format!("{TRANSLATION_KEYRING_KEY_PREFIX}:{provider}:{DEFAULT_TRANSLATION_PROFILE}");
    let entry = Entry::new(KEYRING_SERVICE_NAME, &keyring_key)
        .map_err(|e| format!("Keyring error for {provider}: {e}"))?;
    let password = entry
        .get_password()
        .map_err(|e| format!("No API key for {provider}: {e}"))?;
    if password.trim().is_empty() {
        return Err(format!("API key for {provider} is empty"));
    }
    Ok(password)
}

fn resolve_timeout(settings: Option<&ReaderTranslationProviderSettings>) -> Duration {
    let ms = settings
        .and_then(|v| v.timeout_ms)
        .unwrap_or(DEFAULT_SUMMARIZE_TIMEOUT_MS)
        .max(500) as u64;
    Duration::from_millis(ms)
}

fn resolve_endpoint(
    base_url_override: Option<&str>,
    default_base_url: &str,
    required_path: &str,
) -> String {
    let base = base_url_override
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or(default_base_url);
    let path = format!("/{}", required_path.trim_start_matches('/'));
    let base_normalized = base.trim_end_matches('/');
    if base_normalized.ends_with(path.as_str()) {
        return base_normalized.to_string();
    }
    format!("{base_normalized}{path}")
}

fn get_default_base_url(provider: &str) -> &str {
    match provider {
        "openai" => OPENAI_DEFAULT_BASE_URL,
        "anthropic" => ANTHROPIC_DEFAULT_BASE_URL,
        "gemini" => GEMINI_DEFAULT_BASE_URL,
        "openrouter" => OPENROUTER_DEFAULT_BASE_URL,
        "glm" => GLM_DEFAULT_BASE_URL,
        "kimi" => KIMI_DEFAULT_BASE_URL,
        "minimax" => MINIMAX_DEFAULT_BASE_URL,
        "qwen" => QWEN_DEFAULT_BASE_URL,
        "deepseek" => DEEPSEEK_DEFAULT_BASE_URL,
        "ollama" => OLLAMA_DEFAULT_BASE_URL,
        _ => OPENAI_DEFAULT_BASE_URL,
    }
}

async fn call_llm(
    provider: &str,
    text: &str,
    system_prompt: &str,
    api_key: Option<&str>,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    match provider {
        OLLAMA_PROVIDER => call_ollama(text, system_prompt, api_key, settings).await,
        ANTHROPIC_PROVIDER => {
            let key = api_key.ok_or("Anthropic API key is missing")?;
            call_anthropic(text, system_prompt, key, settings).await
        }
        "gemini" => {
            let key = api_key.ok_or("Gemini API key is missing")?;
            call_gemini(text, system_prompt, key, settings).await
        }
        _ => {
            let key = api_key.ok_or_else(|| format!("{provider} API key is missing"))?;
            call_openai_compatible(provider, text, system_prompt, key, settings).await
        }
    }
}

async fn call_openai_compatible(
    provider: &str,
    text: &str,
    system_prompt: &str,
    api_key: &str,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    let model = settings
        .and_then(|v| v.model.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| format!("{provider} model is required"))?;
    let endpoint = resolve_endpoint(
        settings.and_then(|v| v.base_url.as_deref()),
        get_default_base_url(provider),
        "/v1/chat/completions",
    );
    let timeout = resolve_timeout(settings);

    log::info!("summarize({provider}): POST {endpoint} | model={model}");

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let payload = serde_json::json!({
        "model": model,
        "stream": false,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": text }
        ]
    });

    let response = client
        .post(&endpoint)
        .bearer_auth(api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("{provider} request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("{provider} returned {}: {body}", status.as_u16()));
    }

    let body: OpenAiChatCompletionsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse {provider} response: {e}"))?;
    if let Some(err) = body.error.and_then(|e| e.message) {
        return Err(format!("{provider} error: {err}"));
    }

    body.choices
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.message)
        .and_then(|m| m.content)
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .ok_or_else(|| format!("{provider} returned empty response"))
}

async fn call_anthropic(
    text: &str,
    system_prompt: &str,
    api_key: &str,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    let model = settings
        .and_then(|v| v.model.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or("Anthropic model is required")?;
    let endpoint = resolve_endpoint(
        settings.and_then(|v| v.base_url.as_deref()),
        ANTHROPIC_DEFAULT_BASE_URL,
        "/v1/messages",
    );
    let timeout = resolve_timeout(settings);

    log::info!("summarize(anthropic): POST {endpoint} | model={model}");

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let payload = serde_json::json!({
        "model": model,
        "max_tokens": 1024,
        "system": system_prompt,
        "messages": [
            { "role": "user", "content": text }
        ]
    });

    let response = client
        .post(&endpoint)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic returned {}: {body}", status.as_u16()));
    }

    let body: AnthropicMessagesResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic response: {e}"))?;
    if let Some(err) = body.error.and_then(|e| e.message) {
        return Err(format!("Anthropic error: {err}"));
    }

    body.content
        .and_then(|blocks| blocks.into_iter().next())
        .and_then(|block| block.text)
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .ok_or_else(|| "Anthropic returned empty response".to_string())
}

async fn call_gemini(
    text: &str,
    system_prompt: &str,
    api_key: &str,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    let model = settings
        .and_then(|v| v.model.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or("Gemini model is required")?;
    let base_url = settings
        .and_then(|v| v.base_url.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or(GEMINI_DEFAULT_BASE_URL);
    let endpoint = format!(
        "{}/v1beta/models/{model}:generateContent?key={api_key}",
        base_url.trim_end_matches('/')
    );
    let timeout = resolve_timeout(settings);

    log::info!("summarize(gemini): POST .../{model}:generateContent");

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let payload = serde_json::json!({
        "system_instruction": {
            "parts": [{ "text": system_prompt }]
        },
        "contents": [{
            "parts": [{ "text": text }]
        }]
    });

    let response = client
        .post(&endpoint)
        .header("content-type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Gemini returned {}: {body}", status.as_u16()));
    }

    let body: GeminiGenerateContentResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Gemini response: {e}"))?;
    if let Some(err) = body.error.and_then(|e| e.message) {
        return Err(format!("Gemini error: {err}"));
    }

    body.candidates
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.content)
        .and_then(|c| c.parts)
        .and_then(|p| p.into_iter().next())
        .and_then(|p| p.text)
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .ok_or_else(|| "Gemini returned empty response".to_string())
}

async fn call_ollama(
    text: &str,
    system_prompt: &str,
    api_key: Option<&str>,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    let model = settings
        .and_then(|v| v.model.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or("Ollama model is required")?;
    let endpoint = resolve_endpoint(
        settings.and_then(|v| v.base_url.as_deref()),
        OLLAMA_DEFAULT_BASE_URL,
        "/api/chat",
    );
    let timeout = resolve_timeout(settings);

    log::info!("summarize(ollama): POST {endpoint} | model={model}");

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let payload = serde_json::json!({
        "model": model,
        "stream": false,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": text }
        ]
    });

    let mut req = client.post(&endpoint).json(&payload);
    if let Some(key) = api_key {
        if !key.trim().is_empty() {
            req = req.bearer_auth(key);
        }
    }

    let response = req
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Ollama returned {}: {body}", status.as_u16()));
    }

    let body: OllamaChatResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {e}"))?;
    if let Some(err) = body.error {
        return Err(format!("Ollama error: {err}"));
    }

    body.message
        .map(|m| m.content)
        .or(body.response)
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .ok_or_else(|| "Ollama returned empty response".to_string())
}

// ── Code language detection ──

const CODE_DETECTION_PROMPT: &str = "\
You are a programming language identifier. \
Given a code snippet, respond with ONLY the programming language name in lowercase. \
For example: rust, python, javascript, typescript, c, cpp, go, java, etc. \
If you cannot identify the language, respond with: text \
Do not include any other text, explanation, or formatting.";

#[tauri::command]
#[specta::specta]
pub async fn detect_code_language(app: AppHandle, code: String) -> Result<String, String> {
    let code = code.trim();
    if code.is_empty() {
        return Ok("text".to_string());
    }

    // Truncate to save tokens
    let truncated = truncate_str(code, 500);

    let preferences = load_preferences_sync(&app).unwrap_or_default();
    let provider_settings = &preferences.reader_translation_provider_settings;

    let prompt = preferences
        .reader_code_detection_prompt
        .as_deref()
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .unwrap_or(CODE_DETECTION_PROMPT);

    // Use same provider resolution as summarize: dedicated summary provider → llm fallbacks → all LLMs
    let dedicated_provider = preferences
        .ai_summary_provider
        .as_deref()
        .map(str::trim)
        .filter(|p| !p.is_empty() && is_llm_provider(p));

    if let Some(provider) = dedicated_provider {
        let api_key = get_provider_key(provider).ok();
        if api_key.is_some() || provider == OLLAMA_PROVIDER {
            let settings = provider_settings.get(provider);
            if let Ok(result) =
                call_llm(provider, truncated, prompt, api_key.as_deref(), settings).await
            {
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
        if let Ok(result) =
            call_llm(provider, truncated, prompt, api_key.as_deref(), settings).await
        {
            return Ok(result.trim().to_lowercase());
        }
    }

    Err("No LLM provider available for code detection".to_string())
}

// ── Streaming event payload ──

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SummarizeStreamEvent {
    /// Unique stream ID to correlate chunks with the request.
    pub stream_id: String,
    /// "delta" for text chunks, "done" for completion, "error" for failure.
    pub event: String,
    /// Text delta (for "delta" events) or full accumulated text (for "done").
    pub text: String,
    /// Provider name (set on "done").
    pub provider_used: Option<String>,
    /// Model name (set on "done").
    pub model_used: Option<String>,
}

// ── Streaming Tauri command ──

#[tauri::command]
#[specta::specta]
pub async fn summarize_article_stream(
    app: AppHandle,
    request: SummarizeArticleRequest,
    stream_id: String,
) -> Result<(), String> {
    let preferences = load_preferences_sync(&app).unwrap_or_default();
    let max_len = preferences.ai_summary_max_text_length as usize;

    let text = request.text.trim();
    if text.is_empty() {
        return Err("Article text is empty".to_string());
    }
    let text = truncate_str(text, max_len);

    let provider_settings = &preferences.reader_translation_provider_settings;
    let system_prompt = build_summary_prompt(
        request.language.as_deref(),
        preferences.ai_summary_custom_prompt.as_deref(),
    );

    // If a dedicated summary provider is configured, use it directly
    let dedicated_provider = preferences
        .ai_summary_provider
        .as_deref()
        .map(str::trim)
        .filter(|p| !p.is_empty() && is_llm_provider(p));
    let model_override = preferences
        .ai_summary_model
        .as_deref()
        .map(str::trim)
        .filter(|m| !m.is_empty());

    if let Some(provider) = dedicated_provider {
        let api_key = if provider == OLLAMA_PROVIDER {
            get_provider_key(provider).ok()
        } else {
            match get_provider_key(provider) {
                Ok(key) => Some(key),
                Err(e) => {
                    let error_msg = format!("API key not found for {provider}: {e}");
                    let _ = app.emit(
                        "summarize-stream",
                        SummarizeStreamEvent {
                            stream_id,
                            event: "error".to_string(),
                            text: error_msg.clone(),
                            provider_used: None,
                            model_used: None,
                        },
                    );
                    return Err(error_msg);
                }
            }
        };

        // Build settings with model override if specified
        let base_settings = provider_settings.get(provider);
        let overridden_settings;
        let effective_settings = if let Some(model_name) = model_override {
            overridden_settings = ReaderTranslationProviderSettings {
                enabled: true,
                model: Some(model_name.to_string()),
                base_url: base_settings.and_then(|s| s.base_url.clone()),
                timeout_ms: base_settings.and_then(|s| s.timeout_ms),
                system_prompt: base_settings.and_then(|s| s.system_prompt.clone()),
            };
            Some(&overridden_settings)
        } else {
            base_settings
        };

        let model = model_override
            .map(|m| m.to_string())
            .unwrap_or_else(|| get_model_name(effective_settings));

        let result = call_llm_stream(
            &app,
            &stream_id,
            provider,
            text,
            &system_prompt,
            api_key.as_deref(),
            effective_settings,
        )
        .await;

        match result {
            Ok(full_text) => {
                let _ = app.emit(
                    "summarize-stream",
                    SummarizeStreamEvent {
                        stream_id,
                        event: "done".to_string(),
                        text: full_text,
                        provider_used: Some(provider.to_string()),
                        model_used: Some(model),
                    },
                );
                return Ok(());
            }
            Err(e) => {
                let error_msg = format!("Summary failed: {provider}: {e}");
                let _ = app.emit(
                    "summarize-stream",
                    SummarizeStreamEvent {
                        stream_id,
                        event: "error".to_string(),
                        text: error_msg.clone(),
                        provider_used: None,
                        model_used: None,
                    },
                );
                return Err(error_msg);
            }
        }
    }

    // Fallback: iterate through translation LLM provider chain
    let mut providers: Vec<String> = Vec::new();
    for provider_id in &preferences.reader_translation_llm_fallbacks {
        if is_llm_provider(provider_id) {
            providers.push(provider_id.clone());
        }
    }
    if providers.is_empty() {
        for &provider_id in LLM_PROVIDERS {
            providers.push(provider_id.to_string());
        }
    }
    if providers.is_empty() {
        return Err(
            "No LLM provider configured. Set up an LLM provider in AI Summary or Translation settings."
                .to_string(),
        );
    }

    let mut errors: Vec<String> = Vec::new();
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
        let model = get_model_name(settings);

        let result = call_llm_stream(
            &app,
            &stream_id,
            provider,
            text,
            &system_prompt,
            api_key.as_deref(),
            settings,
        )
        .await;

        match result {
            Ok(full_text) => {
                let _ = app.emit(
                    "summarize-stream",
                    SummarizeStreamEvent {
                        stream_id,
                        event: "done".to_string(),
                        text: full_text,
                        provider_used: Some(provider.clone()),
                        model_used: Some(model),
                    },
                );
                return Ok(());
            }
            Err(e) => {
                errors.push(format!("{provider}: {e}"));
            }
        }
    }

    let error_msg = if errors.is_empty() {
        "No LLM provider available. Configure an LLM provider with an API key and model in AI Summary or Translation settings.".to_string()
    } else {
        format!("Summary failed: {}", errors.join(" | "))
    };

    let _ = app.emit(
        "summarize-stream",
        SummarizeStreamEvent {
            stream_id,
            event: "error".to_string(),
            text: error_msg.clone(),
            provider_used: None,
            model_used: None,
        },
    );

    Err(error_msg)
}

// ── Streaming LLM call ──

async fn call_llm_stream(
    app: &AppHandle,
    stream_id: &str,
    provider: &str,
    text: &str,
    system_prompt: &str,
    api_key: Option<&str>,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    match provider {
        OLLAMA_PROVIDER => {
            call_ollama_stream(app, stream_id, text, system_prompt, api_key, settings).await
        }
        ANTHROPIC_PROVIDER => {
            let key = api_key.ok_or("Anthropic API key is missing")?;
            call_anthropic_stream(app, stream_id, text, system_prompt, key, settings).await
        }
        "gemini" => {
            let key = api_key.ok_or("Gemini API key is missing")?;
            call_gemini_stream(app, stream_id, text, system_prompt, key, settings).await
        }
        _ => {
            let key = api_key.ok_or_else(|| format!("{provider} API key is missing"))?;
            call_openai_compatible_stream(
                app,
                stream_id,
                provider,
                text,
                system_prompt,
                key,
                settings,
            )
            .await
        }
    }
}

fn emit_delta(app: &AppHandle, stream_id: &str, delta: &str) {
    let _ = app.emit(
        "summarize-stream",
        SummarizeStreamEvent {
            stream_id: stream_id.to_string(),
            event: "delta".to_string(),
            text: delta.to_string(),
            provider_used: None,
            model_used: None,
        },
    );
}

async fn call_openai_compatible_stream(
    app: &AppHandle,
    stream_id: &str,
    provider: &str,
    text: &str,
    system_prompt: &str,
    api_key: &str,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    let model = settings
        .and_then(|v| v.model.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| format!("{provider} model is required"))?;
    let endpoint = resolve_endpoint(
        settings.and_then(|v| v.base_url.as_deref()),
        get_default_base_url(provider),
        "/v1/chat/completions",
    );
    let timeout = resolve_timeout(settings);

    log::info!("summarize-stream({provider}): POST {endpoint} | model={model}");

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let payload = serde_json::json!({
        "model": model,
        "stream": true,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": text }
        ]
    });

    let response = client
        .post(&endpoint)
        .bearer_auth(api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("{provider} request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("{provider} returned {}: {body}", status.as_u16()));
    }

    let app_clone = app.clone();
    let sid = stream_id.to_string();
    llm_stream::stream_openai_compatible(response, &mut |delta| {
        emit_delta(&app_clone, &sid, delta);
    })
    .await
}

async fn call_anthropic_stream(
    app: &AppHandle,
    stream_id: &str,
    text: &str,
    system_prompt: &str,
    api_key: &str,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    let model = settings
        .and_then(|v| v.model.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or("Anthropic model is required")?;
    let endpoint = resolve_endpoint(
        settings.and_then(|v| v.base_url.as_deref()),
        ANTHROPIC_DEFAULT_BASE_URL,
        "/v1/messages",
    );
    let timeout = resolve_timeout(settings);

    log::info!("summarize-stream(anthropic): POST {endpoint} | model={model}");

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let payload = serde_json::json!({
        "model": model,
        "max_tokens": 1024,
        "stream": true,
        "system": system_prompt,
        "messages": [
            { "role": "user", "content": text }
        ]
    });

    let response = client
        .post(&endpoint)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic returned {}: {body}", status.as_u16()));
    }

    let app_clone = app.clone();
    let sid = stream_id.to_string();
    llm_stream::stream_anthropic(response, &mut |delta| {
        emit_delta(&app_clone, &sid, delta);
    })
    .await
}

async fn call_gemini_stream(
    app: &AppHandle,
    stream_id: &str,
    text: &str,
    system_prompt: &str,
    api_key: &str,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    let model = settings
        .and_then(|v| v.model.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or("Gemini model is required")?;
    let base_url = settings
        .and_then(|v| v.base_url.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or(GEMINI_DEFAULT_BASE_URL);
    let endpoint = format!(
        "{}/v1beta/models/{model}:streamGenerateContent?key={api_key}&alt=sse",
        base_url.trim_end_matches('/')
    );
    let timeout = resolve_timeout(settings);

    log::info!("summarize-stream(gemini): POST .../{model}:streamGenerateContent");

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let payload = serde_json::json!({
        "system_instruction": {
            "parts": [{ "text": system_prompt }]
        },
        "contents": [{
            "parts": [{ "text": text }]
        }]
    });

    let response = client
        .post(&endpoint)
        .header("content-type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Gemini returned {}: {body}", status.as_u16()));
    }

    let app_clone = app.clone();
    let sid = stream_id.to_string();
    llm_stream::stream_gemini(response, &mut |delta| {
        emit_delta(&app_clone, &sid, delta);
    })
    .await
}

async fn call_ollama_stream(
    app: &AppHandle,
    stream_id: &str,
    text: &str,
    system_prompt: &str,
    api_key: Option<&str>,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    let model = settings
        .and_then(|v| v.model.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or("Ollama model is required")?;
    let endpoint = resolve_endpoint(
        settings.and_then(|v| v.base_url.as_deref()),
        OLLAMA_DEFAULT_BASE_URL,
        "/api/chat",
    );
    let timeout = resolve_timeout(settings);

    log::info!("summarize-stream(ollama): POST {endpoint} | model={model}");

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let payload = serde_json::json!({
        "model": model,
        "stream": true,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": text }
        ]
    });

    let mut req = client.post(&endpoint).json(&payload);
    if let Some(key) = api_key {
        if !key.trim().is_empty() {
            req = req.bearer_auth(key);
        }
    }

    let response = req
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Ollama returned {}: {body}", status.as_u16()));
    }

    let app_clone = app.clone();
    let sid = stream_id.to_string();
    llm_stream::stream_ollama(response, &mut |delta| {
        emit_delta(&app_clone, &sid, delta);
    })
    .await
}

// ── Article summary persistence (SQLite) ──

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ArticleSummaryRecord {
    pub entry_id: String,
    pub summary: String,
    pub provider_used: Option<String>,
    pub model_used: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub async fn get_article_summary(
    app: AppHandle,
    entry_id: String,
) -> Result<Option<ArticleSummaryRecord>, String> {
    let state: tauri::State<'_, crate::AppState> = app.state();
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    let row = sqlx::query(
        "SELECT entry_id, summary, provider_used, model_used FROM article_summaries WHERE entry_id = ?",
    )
    .bind(&entry_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| format!("{e}"))?;

    match row {
        Some(r) => Ok(Some(ArticleSummaryRecord {
            entry_id: r.get("entry_id"),
            summary: r.get("summary"),
            provider_used: r.get("provider_used"),
            model_used: r.get("model_used"),
        })),
        None => Ok(None),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn save_article_summary(
    app: AppHandle,
    entry_id: String,
    summary: String,
    provider_used: Option<String>,
    model_used: Option<String>,
) -> Result<(), String> {
    let state: tauri::State<'_, crate::AppState> = app.state();
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO article_summaries (entry_id, summary, provider_used, model_used, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(entry_id) DO UPDATE SET
            summary = excluded.summary,
            provider_used = excluded.provider_used,
            model_used = excluded.model_used,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(&entry_id)
    .bind(&summary)
    .bind(&provider_used)
    .bind(&model_used)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .map_err(|e| format!("{e}"))?;

    Ok(())
}
