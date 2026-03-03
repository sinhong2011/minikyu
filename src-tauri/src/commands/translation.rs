use keyring::Entry;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
#[cfg(target_os = "macos")]
use std::io::Read;
#[cfg(target_os = "macos")]
use std::process::{Command, Stdio};
#[cfg(target_os = "macos")]
use std::thread;
use std::time::Duration;
#[cfg(target_os = "macos")]
use std::time::Instant;
use tauri::{AppHandle, Emitter};

use crate::commands::preferences::load_preferences_sync;
use crate::types::ReaderTranslationProviderSettings;
use crate::utils::llm_stream;

const KEYRING_SERVICE_NAME: &str = "minikyu";
const TRANSLATION_KEYRING_KEY_PREFIX: &str = "minikyu:translation";
const DEFAULT_TRANSLATION_PROFILE: &str = "default";
const APPLE_BUILT_IN_PROVIDER: &str = "apple_built_in";
const DEEPL_PROVIDER: &str = "deepl";
const GOOGLE_TRANSLATE_PROVIDER: &str = "google_translate";
const OLLAMA_PROVIDER: &str = "ollama";
const DEEPL_DEFAULT_BASE_URL: &str = "https://api-free.deepl.com/v2";
const DEEPL_TRANSLATE_PATH: &str = "/translate";
const GOOGLE_TRANSLATE_DEFAULT_BASE_URL: &str = "https://translation.googleapis.com";
const GOOGLE_TRANSLATE_PATH: &str = "/language/translate/v2";
const OLLAMA_DEFAULT_BASE_URL: &str = "http://localhost:11434";
const OLLAMA_CHAT_PATH: &str = "/api/chat";
const OLLAMA_TAGS_PATH: &str = "/api/tags";
const OPENAI_PROVIDER: &str = "openai";
const ANTHROPIC_PROVIDER: &str = "anthropic";
const GEMINI_PROVIDER: &str = "gemini";
const OPENAI_DEFAULT_BASE_URL: &str = "https://api.openai.com";
const ANTHROPIC_DEFAULT_BASE_URL: &str = "https://api.anthropic.com";
const GEMINI_DEFAULT_BASE_URL: &str = "https://generativelanguage.googleapis.com";
const OPENROUTER_DEFAULT_BASE_URL: &str = "https://openrouter.ai";
const GLM_DEFAULT_BASE_URL: &str = "https://open.bigmodel.cn/api/paas/v4";
const KIMI_DEFAULT_BASE_URL: &str = "https://api.moonshot.cn";
const MINIMAX_DEFAULT_BASE_URL: &str = "https://api.minimax.io";
const QWEN_DEFAULT_BASE_URL: &str = "https://dashscope.aliyuncs.com/compatible-mode";
const DEEPSEEK_DEFAULT_BASE_URL: &str = "https://api.deepseek.com";
const OPENAI_COMPATIBLE_MODELS_PATH: &str = "/v1/models";
const OPENROUTER_MODELS_PATH: &str = "/api/v1/models";
const GLM_MODELS_PATH: &str = "/models";
const GEMINI_MODELS_PATH: &str = "/v1beta/models";
const DEFAULT_PROVIDER_TIMEOUT_MS: u32 = 15_000;
const DEFAULT_LLM_TRANSLATION_PROMPT: &str = "\
You are a professional {source_lang} to {target_lang} translator. \
Accurately convey the meaning and nuances of the original text while \
adhering to {target_lang} grammar, vocabulary, and cultural sensitivities. \
Produce only the {target_lang} translation, without any additional \
explanations or commentary.";
const MAX_TRANSLATION_PROVIDER_OR_PROFILE_LENGTH: usize = 100;
const MAX_TRANSLATION_TEXT_LENGTH: usize = 20_000;
const MAX_TRANSLATION_LANGUAGE_LENGTH: usize = 32;
#[cfg(target_os = "macos")]
const APPLE_TRANSLATION_TIMEOUT_SECONDS: &str = "12";
const LLM_TRANSLATION_PROVIDERS: &[&str] = &[
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

#[cfg(target_os = "macos")]
const APPLE_TRANSLATION_HELPER_BINARY: &str = "apple_translation_helper";
#[cfg(target_os = "macos")]
const APPLE_TRANSLATION_HELPER_SWIFT: &str = r#"
import Foundation
import NaturalLanguage
import Translation

@main
struct MinikyuAppleTranslationHelper {
  enum HelperError: LocalizedError {
    case sourceLanguageUndetermined
    case unsupportedLanguagePair(source: String, target: String)
    case availabilityCheckTimedOut(seconds: UInt64)
    case preparationTimedOut(seconds: UInt64)
    case translationTimedOut(seconds: UInt64)
    case emptyTranslationResult

    var errorDescription: String? {
      switch self {
      case .sourceLanguageUndetermined:
        return "Unable to determine source language for Apple translation."
      case let .unsupportedLanguagePair(source, target):
        return "Apple built-in translation does not support \(source) -> \(target)."
      case let .availabilityCheckTimedOut(seconds):
        return "Apple translation availability check timed out after \(seconds) seconds."
      case let .preparationTimedOut(seconds):
        return "Apple translation model preparation timed out after \(seconds) seconds."
      case let .translationTimedOut(seconds):
        return "Apple translation request timed out after \(seconds) seconds."
      case .emptyTranslationResult:
        return "Apple built-in translation returned empty text."
      }
    }
  }

  @available(macOS 26.0, *)
  static func canonicalLanguageIdentifier(_ rawValue: String) -> String {
    let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
    return Locale.canonicalLanguageIdentifier(from: trimmed)
  }

  @available(macOS 26.0, *)
  static func runWithTimeout<T: Sendable>(
    seconds: UInt64,
    timeoutError: @autoclosure @escaping () -> Error,
    operation: @escaping @Sendable () async throws -> T
  ) async throws -> T {
    try await withThrowingTaskGroup(of: T.self) { group in
      group.addTask {
        try await operation()
      }
      group.addTask {
        try await Task.sleep(nanoseconds: seconds * 1_000_000_000)
        throw timeoutError()
      }

      defer {
        group.cancelAll()
      }

      guard let nextResult = try await group.next() else {
        throw timeoutError()
      }
      return nextResult
    }
  }

  @available(macOS 26.0, *)
  static func resolveSourceLanguage(explicitSource: String?, text: String) -> String? {
    if let explicitSource {
      let trimmedSource = canonicalLanguageIdentifier(explicitSource)
      if !trimmedSource.isEmpty {
        return trimmedSource
      }
    }

    guard let detected = NLLanguageRecognizer.dominantLanguage(for: text) else {
      return nil
    }
    if detected == .undetermined {
      return nil
    }

    return canonicalLanguageIdentifier(detected.rawValue)
  }

  static func writeStderr(_ message: String) {
    guard let data = (message + "\n").data(using: .utf8) else {
      return
    }
    FileHandle.standardError.write(data)
  }

  static func writeStdout(_ message: String) {
    guard let data = message.data(using: .utf8) else {
      return
    }
    FileHandle.standardOutput.write(data)
  }

  static func main() async {
    guard #available(macOS 26.0, *) else {
      writeStderr("Apple Translation API requires macOS 26 or newer.")
      Foundation.exit(2)
    }

    let env = ProcessInfo.processInfo.environment
    let text = env["MINIKYU_TRANSLATION_TEXT"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let targetLanguage = canonicalLanguageIdentifier(env["MINIKYU_TRANSLATION_TARGET"] ?? "")
    let sourceLanguage = env["MINIKYU_TRANSLATION_SOURCE"]
    let configuredTimeout = UInt64(env["MINIKYU_TRANSLATION_TIMEOUT_SECONDS"] ?? "") ?? 12
    let timeoutSeconds = max(3, min(configuredTimeout, 60))

    if text.isEmpty {
      writeStderr("Translation text cannot be empty.")
      Foundation.exit(3)
    }

    if targetLanguage.isEmpty {
      writeStderr("Target language cannot be empty.")
      Foundation.exit(4)
    }

    guard let resolvedSourceLanguage = resolveSourceLanguage(explicitSource: sourceLanguage, text: text) else {
      writeStderr("E_SOURCE_UNDETERMINED: \(HelperError.sourceLanguageUndetermined.localizedDescription)")
      Foundation.exit(5)
    }

    if resolvedSourceLanguage == targetLanguage {
      writeStdout(text)
      Foundation.exit(0)
    }

    do {
      let sourceLocale = Locale.Language(identifier: resolvedSourceLanguage)
      let targetLocale = Locale.Language(identifier: targetLanguage)
      let availability = LanguageAvailability()
      let availabilityStatus = try await runWithTimeout(
        seconds: timeoutSeconds,
        timeoutError: HelperError.availabilityCheckTimedOut(seconds: timeoutSeconds)
      ) {
        await availability.status(from: sourceLocale, to: targetLocale)
      }
      if availabilityStatus == .unsupported {
        throw HelperError.unsupportedLanguagePair(
          source: resolvedSourceLanguage,
          target: targetLanguage
        )
      }

      let session = TranslationSession(
        installedSource: sourceLocale,
        target: targetLocale
      )

      if availabilityStatus == .supported {
        _ = try await runWithTimeout(
          seconds: timeoutSeconds,
          timeoutError: HelperError.preparationTimedOut(seconds: timeoutSeconds)
        ) {
          try await session.prepareTranslation()
          return true
        }
      }

      let response = try await runWithTimeout(
        seconds: timeoutSeconds,
        timeoutError: HelperError.translationTimedOut(seconds: timeoutSeconds)
      ) {
        try await session.translate(text).targetText
      }
      if response.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        throw HelperError.emptyTranslationResult
      }
      writeStdout(response)
    } catch {
      writeStderr("Apple Translation failed: \(error.localizedDescription)")
      Foundation.exit(6)
    }
  }
}
"#;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TranslationSegmentRequest {
    pub text: String,
    pub source_language: Option<String>,
    pub target_language: String,
    pub route_mode: String,
    pub primary_engine: Option<String>,
    pub engine_fallbacks: Vec<String>,
    pub llm_fallbacks: Vec<String>,
    pub apple_fallback_enabled: bool,
    pub forced_provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TranslationSegmentResponse {
    pub translated_text: String,
    pub provider_used: String,
    pub fallback_chain: Vec<String>,
}

#[cfg(test)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslationProviderRoute {
    pub provider_used: String,
    pub fallback_chain: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct DeepLTranslateResponse {
    translations: Vec<DeepLTranslationItem>,
}

#[derive(Debug, Deserialize)]
struct DeepLTranslationItem {
    text: String,
}

#[derive(Debug, Deserialize)]
struct GoogleTranslateResponse {
    data: GoogleTranslateData,
}

#[derive(Debug, Deserialize)]
struct GoogleTranslateData {
    translations: Vec<GoogleTranslateItem>,
}

#[derive(Debug, Deserialize)]
struct GoogleTranslateItem {
    #[serde(rename = "translatedText")]
    translated_text: String,
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

#[derive(Debug, Deserialize)]
struct OllamaTagsApiResponse {
    models: Vec<OllamaTagsApiModel>,
}

#[derive(Debug, Deserialize)]
struct OllamaTagsApiModel {
    name: String,
}

#[derive(Debug, Deserialize)]
struct OpenAiModelsApiResponse {
    data: Vec<OpenAiModelsApiModel>,
}

#[derive(Debug, Deserialize)]
struct OpenAiModelsApiModel {
    id: String,
}

#[derive(Debug, Deserialize)]
struct GeminiModelsApiResponse {
    models: Vec<GeminiModelsApiModel>,
}

#[derive(Debug, Deserialize)]
struct GeminiModelsApiModel {
    name: String,
}

/// OpenAI-compatible chat completions response (works for OpenAI, DeepSeek, Qwen, Kimi, etc.)
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

/// Anthropic Messages API response
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

/// Gemini generateContent response
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

fn validate_provider_profile(provider: &str, profile: &str) -> Result<(String, String), String> {
    let provider_trimmed = provider.trim();
    if provider_trimmed.is_empty() {
        return Err("Translation provider cannot be empty".to_string());
    }

    let provider_length = provider_trimmed.chars().count();
    if provider_length > MAX_TRANSLATION_PROVIDER_OR_PROFILE_LENGTH {
        return Err(format!(
            "Translation provider too long (max {MAX_TRANSLATION_PROVIDER_OR_PROFILE_LENGTH} characters)"
        ));
    }

    let profile_trimmed = profile.trim();
    if profile_trimmed.is_empty() {
        return Err("Translation profile cannot be empty".to_string());
    }

    let profile_length = profile_trimmed.chars().count();
    if profile_length > MAX_TRANSLATION_PROVIDER_OR_PROFILE_LENGTH {
        return Err(format!(
            "Translation profile too long (max {MAX_TRANSLATION_PROVIDER_OR_PROFILE_LENGTH} characters)"
        ));
    }

    Ok((provider_trimmed.to_string(), profile_trimmed.to_string()))
}

fn build_translation_keyring_key(provider: &str, profile: &str) -> String {
    format!("{TRANSLATION_KEYRING_KEY_PREFIX}:{provider}:{profile}")
}

fn create_translation_keyring_entry(provider: &str, profile: &str) -> Result<Entry, String> {
    let key = build_translation_keyring_key(provider, profile);
    Entry::new(KEYRING_SERVICE_NAME, &key)
        .map_err(|e| format!("Failed to create translation keyring entry: {e}"))
}

fn normalize_provider_identifier(raw_value: &str) -> Option<String> {
    let value = raw_value.trim();
    if value.is_empty() {
        return None;
    }

    Some(value.to_string())
}

fn push_provider_attempt(attempts: &mut Vec<String>, provider: Option<String>) {
    if let Some(provider_value) = provider {
        attempts.push(provider_value);
    }
}

fn collect_provider_attempts(
    request: &TranslationSegmentRequest,
    _apple_available: bool,
) -> Vec<String> {
    let mut attempts = Vec::new();
    push_provider_attempt(
        &mut attempts,
        request
            .primary_engine
            .as_ref()
            .and_then(|value| normalize_provider_identifier(value)),
    );

    for fallback in &request.engine_fallbacks {
        push_provider_attempt(&mut attempts, normalize_provider_identifier(fallback));
    }

    for fallback in &request.llm_fallbacks {
        push_provider_attempt(&mut attempts, normalize_provider_identifier(fallback));
    }

    attempts
}

fn validate_translation_segment_request(request: &TranslationSegmentRequest) -> Result<(), String> {
    if request.text.trim().is_empty() {
        return Err("Translation text cannot be empty".to_string());
    }

    if request.text.chars().count() > MAX_TRANSLATION_TEXT_LENGTH {
        return Err(format!(
            "Translation text too long (max {MAX_TRANSLATION_TEXT_LENGTH} characters)"
        ));
    }

    if request.target_language.trim().is_empty() {
        return Err("Target language cannot be empty".to_string());
    }

    if request.target_language.chars().count() > MAX_TRANSLATION_LANGUAGE_LENGTH {
        return Err(format!(
            "Target language too long (max {MAX_TRANSLATION_LANGUAGE_LENGTH} characters)"
        ));
    }

    match request.route_mode.as_str() {
        "engine_first" | "hybrid_auto" => Ok(()),
        _ => Err("Unsupported translation route mode".to_string()),
    }
}

fn is_apple_translation_available() -> bool {
    cfg!(target_os = "macos") || cfg!(target_os = "ios")
}

#[cfg(target_os = "macos")]
fn apple_translation_helper_path() -> std::path::PathBuf {
    let helper_dir = std::env::temp_dir().join("minikyu-apple-translation");
    helper_dir.join(APPLE_TRANSLATION_HELPER_BINARY)
}

#[cfg(target_os = "macos")]
fn ensure_apple_translation_helper() -> Result<std::path::PathBuf, String> {
    let helper_path = apple_translation_helper_path();
    let helper_dir = helper_path
        .parent()
        .ok_or_else(|| "Failed to resolve Apple translation helper directory".to_string())?;
    std::fs::create_dir_all(helper_dir)
        .map_err(|e| format!("Failed to create Apple translation helper directory: {e}"))?;

    let source_path = helper_dir.join("apple_translation_helper.swift");
    let should_write_source = match std::fs::read_to_string(&source_path) {
        Ok(existing_source) => existing_source != APPLE_TRANSLATION_HELPER_SWIFT,
        Err(_) => true,
    };
    if should_write_source {
        std::fs::write(&source_path, APPLE_TRANSLATION_HELPER_SWIFT)
            .map_err(|e| format!("Failed to write Apple translation helper source: {e}"))?;
    }

    if helper_path.exists() && !should_write_source {
        return Ok(helper_path);
    }

    let module_cache_path = helper_dir.join("swift-module-cache");
    std::fs::create_dir_all(&module_cache_path)
        .map_err(|e| format!("Failed to create Swift module cache directory: {e}"))?;

    let compile_output = Command::new("xcrun")
        .arg("swiftc")
        .arg("-parse-as-library")
        .arg("-module-cache-path")
        .arg(&module_cache_path)
        .arg(&source_path)
        .arg("-o")
        .arg(&helper_path)
        .output()
        .map_err(|e| format!("Failed to invoke swiftc for Apple translation helper: {e}"))?;

    if !compile_output.status.success() {
        let stderr = String::from_utf8_lossy(&compile_output.stderr);
        return Err(format!(
            "Failed to compile Apple translation helper: {}",
            stderr.trim()
        ));
    }

    Ok(helper_path)
}

#[cfg(target_os = "macos")]
fn translate_with_apple_built_in(
    request: &TranslationSegmentRequest,
) -> Result<TranslationSegmentResponse, String> {
    let helper_path = ensure_apple_translation_helper()?;
    let source_language = request.source_language.clone().unwrap_or_default();
    let helper_timeout_seconds = APPLE_TRANSLATION_TIMEOUT_SECONDS
        .parse::<u64>()
        .unwrap_or(12);
    let helper_process_timeout = Duration::from_secs(helper_timeout_seconds + 3);

    let mut child = Command::new(helper_path)
        .env("MINIKYU_TRANSLATION_TEXT", request.text.as_str())
        .env("MINIKYU_TRANSLATION_SOURCE", source_language)
        .env(
            "MINIKYU_TRANSLATION_TIMEOUT_SECONDS",
            APPLE_TRANSLATION_TIMEOUT_SECONDS,
        )
        .env(
            "MINIKYU_TRANSLATION_TARGET",
            request.target_language.as_str(),
        )
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute Apple translation helper: {e}"))?;

    let stdout_pipe = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture Apple translation helper stdout".to_string())?;
    let stderr_pipe = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture Apple translation helper stderr".to_string())?;
    let stdout_collector = thread::spawn(move || {
        let mut buffer = Vec::new();
        let mut pipe = stdout_pipe;
        let _ = pipe.read_to_end(&mut buffer);
        buffer
    });
    let stderr_collector = thread::spawn(move || {
        let mut buffer = Vec::new();
        let mut pipe = stderr_pipe;
        let _ = pipe.read_to_end(&mut buffer);
        buffer
    });

    let started_at = Instant::now();
    let exit_status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if started_at.elapsed() >= helper_process_timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = stdout_collector.join();
                    let _ = stderr_collector.join();
                    return Err(
                        "Apple built-in translation helper timed out before completion".to_string(),
                    );
                }
                thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = stdout_collector.join();
                let _ = stderr_collector.join();
                return Err(format!(
                    "Failed while waiting for Apple translation helper: {e}"
                ));
            }
        }
    };

    let stdout = stdout_collector
        .join()
        .map_err(|_| "Failed to collect Apple translation helper stdout".to_string())?;
    let stderr = stderr_collector
        .join()
        .map_err(|_| "Failed to collect Apple translation helper stderr".to_string())?;

    if !exit_status.success() {
        let stderr = String::from_utf8_lossy(&stderr);
        let mapped_error = map_apple_translation_stderr(stderr.as_ref());
        return Err(format!(
            "Apple built-in translation failed: {}",
            mapped_error
        ));
    }

    let translated_text = String::from_utf8(stdout)
        .map_err(|e| format!("Apple translation output was not valid UTF-8: {e}"))?;
    let translated_text_trimmed = translated_text.trim().to_string();

    if translated_text_trimmed.is_empty() {
        return Err("Apple built-in translation returned empty text".to_string());
    }

    Ok(TranslationSegmentResponse {
        translated_text: translated_text_trimmed,
        provider_used: APPLE_BUILT_IN_PROVIDER.to_string(),
        fallback_chain: vec![APPLE_BUILT_IN_PROVIDER.to_string()],
    })
}

#[cfg(target_os = "macos")]
fn map_apple_translation_stderr(stderr: &str) -> String {
    let stderr_trimmed = stderr.trim();
    if stderr_trimmed.contains("E_SOURCE_UNDETERMINED:") {
        return "Apple built-in translation could not detect the source language".to_string();
    }
    if stderr_trimmed.contains("does not support") {
        return "Apple built-in translation does not support this language pair".to_string();
    }
    if stderr_trimmed.contains("availability check timed out")
        || stderr_trimmed.contains("model preparation timed out")
        || stderr_trimmed.contains("request timed out")
    {
        return "Apple built-in translation timed out".to_string();
    }
    if stderr_trimmed.contains("Unable to Translate") {
        return "Apple built-in translation could not translate this content".to_string();
    }

    stderr_trimmed.to_string()
}

#[cfg(not(target_os = "macos"))]
fn translate_with_apple_built_in(
    _request: &TranslationSegmentRequest,
) -> Result<TranslationSegmentResponse, String> {
    Err("Apple built-in translation is only available on macOS".to_string())
}

fn provider_has_key_in_default_profile(provider: &str) -> Result<bool, String> {
    let entry = create_translation_keyring_entry(provider, DEFAULT_TRANSLATION_PROFILE)?;
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(format!(
            "Failed to read translation provider key status: {e}"
        )),
    }
}

fn get_provider_key_in_default_profile(provider: &str) -> Result<String, String> {
    let entry = create_translation_keyring_entry(provider, DEFAULT_TRANSLATION_PROFILE)?;
    match entry.get_password() {
        Ok(api_key) => Ok(api_key),
        Err(keyring::Error::NoEntry) => Err(format!(
            "Translation provider '{provider}' API key is not configured"
        )),
        Err(e) => Err(format!("Failed to read translation provider key: {e}")),
    }
}

fn resolve_provider_timeout_ms(settings: Option<&ReaderTranslationProviderSettings>) -> u64 {
    settings
        .and_then(|value| value.timeout_ms)
        .unwrap_or(DEFAULT_PROVIDER_TIMEOUT_MS)
        .max(500) as u64
}

fn resolve_provider_endpoint(
    base_url_override: Option<&str>,
    default_base_url: &str,
    required_path: &str,
) -> String {
    let candidate_base_url = base_url_override
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(default_base_url);
    let normalized_path = format!("/{}", required_path.trim_start_matches('/'));
    let normalized_base_url = candidate_base_url.trim_end_matches('/');

    if normalized_base_url.ends_with(normalized_path.as_str()) {
        return normalized_base_url.to_string();
    }

    format!("{normalized_base_url}{normalized_path}")
}

fn normalize_deepl_language_code(language: &str) -> Option<String> {
    let normalized = language.trim().replace('_', "-");
    if normalized.is_empty() {
        return None;
    }

    let primary_code = normalized.split('-').next()?.trim().to_uppercase();
    if primary_code.is_empty() {
        return None;
    }

    Some(primary_code)
}

fn normalize_google_language_code(language: &str) -> Option<String> {
    let normalized = language.trim().replace('_', "-");
    if normalized.is_empty() {
        return None;
    }

    let mut segments = normalized.split('-');
    let primary_code = segments.next()?.trim().to_lowercase();
    if primary_code.is_empty() {
        return None;
    }

    let Some(region_code) = segments.next() else {
        return Some(primary_code);
    };

    let region_code_trimmed = region_code.trim();
    if region_code_trimmed.is_empty() {
        return Some(primary_code);
    }

    Some(format!(
        "{}-{}",
        primary_code,
        region_code_trimmed.to_uppercase()
    ))
}

fn map_deepl_http_error(status: reqwest::StatusCode) -> String {
    match status.as_u16() {
        401 | 403 => "DeepL authentication failed. Please check API key".to_string(),
        429 => "DeepL request rate limit exceeded".to_string(),
        456 => "DeepL quota exceeded".to_string(),
        _ => format!("DeepL request failed with status {}", status.as_u16()),
    }
}

fn map_google_translate_http_error(status: reqwest::StatusCode) -> String {
    match status.as_u16() {
        400 | 401 | 403 => {
            "Google Translate authentication failed. Please check API key".to_string()
        }
        429 => "Google Translate request rate limit exceeded".to_string(),
        _ => format!(
            "Google Translate request failed with status {}",
            status.as_u16()
        ),
    }
}

fn map_ollama_http_error(status: reqwest::StatusCode) -> String {
    match status.as_u16() {
        401 | 403 => "Ollama authentication failed. Please check API key".to_string(),
        404 => "Ollama endpoint not found. Check Ollama base URL".to_string(),
        408 | 504 => "Ollama request timed out".to_string(),
        _ => format!("Ollama request failed with status {}", status.as_u16()),
    }
}

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

async fn translate_with_deepl(
    request: &TranslationSegmentRequest,
    api_key: &str,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    let target_language = normalize_deepl_language_code(&request.target_language)
        .ok_or_else(|| "DeepL target language is invalid".to_string())?;
    let source_language = request
        .source_language
        .as_deref()
        .and_then(normalize_deepl_language_code);

    if source_language.as_deref() == Some(target_language.as_str()) {
        return Ok(request.text.clone());
    }

    let endpoint = resolve_provider_endpoint(
        settings.and_then(|value| value.base_url.as_deref()),
        DEEPL_DEFAULT_BASE_URL,
        DEEPL_TRANSLATE_PATH,
    );
    let timeout = Duration::from_millis(resolve_provider_timeout_ms(settings));
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("Failed to initialize DeepL HTTP client: {e}"))?;

    let mut payload = serde_json::json!({
        "text": [request.text.clone()],
        "target_lang": target_language,
    });

    if let Some(source_lang) = source_language {
        payload["source_lang"] = serde_json::Value::String(source_lang);
    }

    let response = client
        .post(endpoint)
        .header("Authorization", format!("DeepL-Auth-Key {api_key}"))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("DeepL request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(map_deepl_http_error(status));
    }

    let body: DeepLTranslateResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse DeepL response: {e}"))?;
    let translated_text = body
        .translations
        .first()
        .map(|translation| translation.text.trim().to_string())
        .unwrap_or_default();

    if translated_text.is_empty() {
        return Err("DeepL returned empty translation".to_string());
    }

    Ok(translated_text)
}

async fn translate_with_google_translate(
    request: &TranslationSegmentRequest,
    api_key: &str,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    let target_language = normalize_google_language_code(&request.target_language)
        .ok_or_else(|| "Google Translate target language is invalid".to_string())?;
    let source_language = request
        .source_language
        .as_deref()
        .and_then(normalize_google_language_code);

    if source_language.as_deref() == Some(target_language.as_str()) {
        return Ok(request.text.clone());
    }

    let endpoint = resolve_provider_endpoint(
        settings.and_then(|value| value.base_url.as_deref()),
        GOOGLE_TRANSLATE_DEFAULT_BASE_URL,
        GOOGLE_TRANSLATE_PATH,
    );
    let timeout = Duration::from_millis(resolve_provider_timeout_ms(settings));
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("Failed to initialize Google Translate HTTP client: {e}"))?;

    let mut payload = serde_json::json!({
        "q": request.text.clone(),
        "target": target_language,
        "format": "text",
    });

    if let Some(source_lang) = source_language {
        payload["source"] = serde_json::Value::String(source_lang);
    }

    let response = client
        .post(endpoint)
        .query(&[("key", api_key)])
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Google Translate request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(map_google_translate_http_error(status));
    }

    let body: GoogleTranslateResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Google Translate response: {e}"))?;
    let translated_text = body
        .data
        .translations
        .first()
        .map(|translation| translation.translated_text.trim().to_string())
        .unwrap_or_default();

    if translated_text.is_empty() {
        return Err("Google Translate returned empty translation".to_string());
    }

    Ok(translated_text)
}

async fn translate_with_ollama(
    request: &TranslationSegmentRequest,
    api_key: Option<&str>,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    let model = settings
        .and_then(|value| value.model.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Ollama model is required".to_string())?;
    let endpoint = resolve_provider_endpoint(
        settings.and_then(|value| value.base_url.as_deref()),
        OLLAMA_DEFAULT_BASE_URL,
        OLLAMA_CHAT_PATH,
    );
    let timeout = Duration::from_millis(resolve_provider_timeout_ms(settings));

    log::info!(
        "ollama: POST {endpoint} | model={model} | auth={}",
        if api_key.is_some() { "bearer" } else { "none" }
    );

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("Failed to initialize Ollama HTTP client: {e}"))?;

    let payload = serde_json::json!({
        "model": model,
        "stream": false,
        "messages": [
            {
                "role": "system",
                "content": resolve_llm_system_prompt(request, settings),
            },
            {
                "role": "user",
                "content": request.text,
            }
        ]
    });

    let mut request_builder = client.post(&endpoint).json(&payload);
    if let Some(key) = api_key {
        request_builder = request_builder.header("Authorization", format!("Bearer {key}"));
    }
    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {e}"))?;
    let status = response.status();
    log::info!("ollama: response status={}", status.as_u16());
    if !status.is_success() {
        if status.as_u16() == 404 {
            let err = format!(
                "Ollama endpoint not found at '{endpoint}'. For local Ollama use http://localhost:11434; for Ollama Cloud use https://ollama.com with a -cloud model (e.g. gpt-oss:120b-cloud)"
            );
            log::warn!("ollama: 404 {err}");
            return Err(err);
        }
        let err = map_ollama_http_error(status);
        log::warn!("ollama: error {err}");
        return Err(err);
    }

    let body: OllamaChatResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {e}"))?;
    if let Some(error) = body
        .error
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        return Err(format!("Ollama error: {error}"));
    }

    let translated_text = body
        .message
        .as_ref()
        .map(|message| message.content.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            body.response
                .as_ref()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
        .unwrap_or_default();

    if translated_text.is_empty() {
        return Err("Ollama returned empty translation".to_string());
    }

    Ok(translated_text)
}

/// Translate using any OpenAI-compatible chat completions API (OpenAI, DeepSeek, Qwen, Kimi, etc.)
async fn translate_with_openai_compatible(
    provider: &str,
    request: &TranslationSegmentRequest,
    api_key: &str,
    settings: Option<&ReaderTranslationProviderSettings>,
    default_base_url: &str,
) -> Result<String, String> {
    let model = settings
        .and_then(|v| v.model.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| format!("{provider} model is required"))?;
    let chat_path = "/v1/chat/completions";
    let endpoint = resolve_provider_endpoint(
        settings.and_then(|v| v.base_url.as_deref()),
        default_base_url,
        chat_path,
    );
    let timeout = Duration::from_millis(resolve_provider_timeout_ms(settings));

    log::info!("{provider}: POST {endpoint} | model={model}");

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("Failed to initialize {provider} HTTP client: {e}"))?;

    let payload = serde_json::json!({
        "model": model,
        "stream": false,
        "messages": [
            {
                "role": "system",
                "content": resolve_llm_system_prompt(request, settings),
            },
            {
                "role": "user",
                "content": request.text,
            }
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
    log::info!("{provider}: response status={}", status.as_u16());
    if !status.is_success() {
        let body_text = response.text().await.unwrap_or_default();
        return Err(format!(
            "{provider} returned {}: {body_text}",
            status.as_u16()
        ));
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
        .ok_or_else(|| format!("{provider} returned an empty translation"))
}

/// Translate using the Anthropic Messages API.
async fn translate_with_anthropic(
    request: &TranslationSegmentRequest,
    api_key: &str,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    let model = settings
        .and_then(|v| v.model.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| "Anthropic model is required".to_string())?;
    let endpoint = resolve_provider_endpoint(
        settings.and_then(|v| v.base_url.as_deref()),
        ANTHROPIC_DEFAULT_BASE_URL,
        "/v1/messages",
    );
    let timeout = Duration::from_millis(resolve_provider_timeout_ms(settings));

    log::info!("anthropic: POST {endpoint} | model={model}");

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("Failed to initialize Anthropic HTTP client: {e}"))?;

    let payload = serde_json::json!({
        "model": model,
        "max_tokens": 4096,
        "system": resolve_llm_system_prompt(request, settings),
        "messages": [
            {
                "role": "user",
                "content": request.text,
            }
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
    log::info!("anthropic: response status={}", status.as_u16());
    if !status.is_success() {
        let body_text = response.text().await.unwrap_or_default();
        return Err(format!(
            "Anthropic returned {}: {body_text}",
            status.as_u16()
        ));
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
        .and_then(|b| b.text)
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .ok_or_else(|| "Anthropic returned an empty translation".to_string())
}

/// Translate using the Gemini generateContent API.
async fn translate_with_gemini(
    request: &TranslationSegmentRequest,
    api_key: &str,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    let model = settings
        .and_then(|v| v.model.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| "Gemini model is required".to_string())?;
    let base_url = settings
        .and_then(|v| v.base_url.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or(GEMINI_DEFAULT_BASE_URL);
    let normalized = base_url.trim_end_matches('/');
    let endpoint = format!("{normalized}/v1beta/models/{model}:generateContent?key={api_key}");
    let timeout = Duration::from_millis(resolve_provider_timeout_ms(settings));

    log::info!("gemini: POST (key omitted) | model={model}");

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("Failed to initialize Gemini HTTP client: {e}"))?;

    let system_prompt = resolve_llm_system_prompt(request, settings);
    let payload = serde_json::json!({
        "system_instruction": {
            "parts": [{ "text": system_prompt }]
        },
        "contents": [{
            "parts": [{ "text": request.text }]
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
    log::info!("gemini: response status={}", status.as_u16());
    if !status.is_success() {
        let body_text = response.text().await.unwrap_or_default();
        return Err(format!("Gemini returned {}: {body_text}", status.as_u16()));
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
        .ok_or_else(|| "Gemini returned an empty translation".to_string())
}

async fn translate_with_external_provider(
    provider: &str,
    request: &TranslationSegmentRequest,
    api_key: Option<&str>,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    match provider {
        DEEPL_PROVIDER => {
            let key = api_key.ok_or_else(|| "DeepL API key is missing".to_string())?;
            translate_with_deepl(request, key, settings).await
        }
        GOOGLE_TRANSLATE_PROVIDER => {
            let key = api_key.ok_or_else(|| "Google Translate API key is missing".to_string())?;
            translate_with_google_translate(request, key, settings).await
        }
        OLLAMA_PROVIDER => translate_with_ollama(request, api_key, settings).await,
        ANTHROPIC_PROVIDER => {
            let key = api_key.ok_or_else(|| "Anthropic API key is missing".to_string())?;
            translate_with_anthropic(request, key, settings).await
        }
        GEMINI_PROVIDER => {
            let key = api_key.ok_or_else(|| "Gemini API key is missing".to_string())?;
            translate_with_gemini(request, key, settings).await
        }
        _ => {
            // All other LLM providers use OpenAI-compatible chat completions API
            let key = api_key.ok_or_else(|| format!("{provider} API key is missing"))?;
            let default_base_url = match provider {
                OPENAI_PROVIDER => OPENAI_DEFAULT_BASE_URL,
                "openrouter" => OPENROUTER_DEFAULT_BASE_URL,
                "glm" => GLM_DEFAULT_BASE_URL,
                "kimi" => KIMI_DEFAULT_BASE_URL,
                "minimax" => MINIMAX_DEFAULT_BASE_URL,
                "qwen" => QWEN_DEFAULT_BASE_URL,
                "deepseek" => DEEPSEEK_DEFAULT_BASE_URL,
                _ => {
                    return Err(format!(
                        "Translation provider '{provider}' is not implemented"
                    ))
                }
            };
            translate_with_openai_compatible(provider, request, key, settings, default_base_url)
                .await
        }
    }
}

fn provider_requires_key(provider: &str) -> bool {
    provider != OLLAMA_PROVIDER
}

fn provider_is_llm(provider: &str) -> bool {
    LLM_TRANSLATION_PROVIDERS.contains(&provider)
}

fn provider_has_runtime_settings(
    provider: &str,
    provider_settings: &HashMap<String, ReaderTranslationProviderSettings>,
) -> bool {
    let Some(settings) = provider_settings.get(provider) else {
        return !provider_is_llm(provider);
    };

    if !settings.enabled {
        return false;
    }

    if provider_is_llm(provider) {
        return settings
            .model
            .as_ref()
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false);
    }

    true
}

#[cfg(test)]
fn translate_with_provider_chain<FAvailable, FTranslate>(
    request: &TranslationSegmentRequest,
    provider_attempts: Vec<String>,
    mut is_provider_available: FAvailable,
    mut translate_provider: FTranslate,
) -> Result<TranslationSegmentResponse, String>
where
    FAvailable: FnMut(&str) -> Result<bool, String>,
    FTranslate: FnMut(&str, &TranslationSegmentRequest) -> Result<String, String>,
{
    if provider_attempts.is_empty() {
        return Err("No translation provider configured".to_string());
    }

    let mut fallback_chain: Vec<String> = Vec::new();
    let mut provider_errors: Vec<String> = Vec::new();

    for provider in provider_attempts {
        if !is_provider_available(&provider)? {
            continue;
        }

        fallback_chain.push(provider.clone());

        match translate_provider(&provider, request) {
            Ok(translated_text) => {
                return Ok(TranslationSegmentResponse {
                    translated_text,
                    provider_used: provider,
                    fallback_chain,
                });
            }
            Err(error) => {
                provider_errors.push(format!("{provider}: {error}"));
            }
        }
    }

    if provider_errors.is_empty() {
        return Err("No available translation provider in fallback chain".to_string());
    }

    Err(format!(
        "Translation failed after provider fallback attempts: {}",
        provider_errors.join(" | ")
    ))
}

#[cfg(test)]
pub fn route_translation_provider<F>(
    request: &TranslationSegmentRequest,
    apple_available: bool,
    mut is_provider_available: F,
) -> Result<TranslationProviderRoute, String>
where
    F: FnMut(&str) -> Result<bool, String>,
{
    let attempts = collect_provider_attempts(request, apple_available);
    if attempts.is_empty() {
        return Err("No translation provider configured".to_string());
    }

    let mut fallback_chain = Vec::new();
    for provider in &attempts {
        fallback_chain.push(provider.clone());
        if is_provider_available(provider)? {
            return Ok(TranslationProviderRoute {
                provider_used: provider.clone(),
                fallback_chain,
            });
        }
    }

    Err(format!(
        "No available translation provider in fallback chain: {}",
        fallback_chain.join(" -> ")
    ))
}

#[tauri::command]
#[specta::specta]
pub async fn save_translation_provider_key(
    provider: String,
    profile: String,
    api_key: String,
) -> Result<(), String> {
    let (provider_normalized, profile_normalized) = validate_provider_profile(&provider, &profile)?;
    let api_key_trimmed = api_key.trim();
    if api_key_trimmed.is_empty() {
        return Err("Translation provider API key cannot be empty".to_string());
    }

    let entry = create_translation_keyring_entry(&provider_normalized, &profile_normalized)?;
    entry
        .set_password(api_key_trimmed)
        .map_err(|e| format!("Failed to save translation provider key: {e}"))?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_translation_provider_key(
    provider: String,
    profile: String,
) -> Result<(), String> {
    let (provider_normalized, profile_normalized) = validate_provider_profile(&provider, &profile)?;
    let entry = create_translation_keyring_entry(&provider_normalized, &profile_normalized)?;

    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Failed to delete translation provider key: {e}")),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_translation_provider_key_status(
    provider: String,
    profile: String,
) -> Result<bool, String> {
    let (provider_normalized, profile_normalized) = validate_provider_profile(&provider, &profile)?;
    let entry = create_translation_keyring_entry(&provider_normalized, &profile_normalized)?;

    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(format!(
            "Failed to get translation provider key status: {e}"
        )),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn translate_reader_segment(
    app: AppHandle,
    request: TranslationSegmentRequest,
) -> Result<TranslationSegmentResponse, String> {
    validate_translation_segment_request(&request)?;

    let preferences = load_preferences_sync(&app).unwrap_or_default();
    let provider_settings = &preferences.reader_translation_provider_settings;
    let apple_available = is_apple_translation_available();
    // If forced_provider is set, skip the fallback chain entirely
    if let Some(ref forced) = request.forced_provider {
        let provider = normalize_provider_identifier(forced)
            .ok_or_else(|| format!("Unknown forced provider: {forced}"))?;

        let available = if provider == APPLE_BUILT_IN_PROVIDER {
            apple_available
        } else if !provider_has_runtime_settings(&provider, provider_settings) {
            false
        } else if !provider_requires_key(&provider) {
            true
        } else {
            provider_has_key_in_default_profile(&provider)?
        };

        if !available {
            return Err(format!("Forced provider '{provider}' is not available"));
        }

        let translated_text = if provider == APPLE_BUILT_IN_PROVIDER {
            translate_with_apple_built_in(&request).map(|r| r.translated_text)
        } else {
            let api_key = if provider_requires_key(&provider) {
                Some(get_provider_key_in_default_profile(&provider)?)
            } else {
                get_provider_key_in_default_profile(&provider).ok()
            };
            let settings = provider_settings.get(provider.as_str());
            translate_with_external_provider(&provider, &request, api_key.as_deref(), settings)
                .await
        }
        .map_err(|e| format!("{provider}: {e}"))?;

        return Ok(TranslationSegmentResponse {
            translated_text,
            provider_used: provider,
            fallback_chain: vec![forced.clone()],
        });
    }

    let provider_attempts = collect_provider_attempts(&request, apple_available);
    if provider_attempts.is_empty() {
        return Err("No translation provider configured".to_string());
    }

    let mut fallback_chain: Vec<String> = Vec::new();
    let mut provider_errors: Vec<String> = Vec::new();

    for provider in provider_attempts {
        let available = if provider == APPLE_BUILT_IN_PROVIDER {
            apple_available
        } else if !provider_has_runtime_settings(&provider, provider_settings) {
            false
        } else if !provider_requires_key(&provider) {
            true
        } else {
            provider_has_key_in_default_profile(&provider)?
        };

        if !available {
            continue;
        }

        fallback_chain.push(provider.clone());

        let translated_result = if provider == APPLE_BUILT_IN_PROVIDER {
            translate_with_apple_built_in(&request).map(|response| response.translated_text)
        } else {
            let api_key = if provider_requires_key(&provider) {
                match get_provider_key_in_default_profile(&provider) {
                    Ok(value) => Some(value),
                    Err(error) => {
                        provider_errors.push(format!("{provider}: {error}"));
                        continue;
                    }
                }
            } else {
                // For providers that accept but don't require a key (e.g. Ollama for cloud API),
                // try to retrieve it if stored; silently skip if not present.
                get_provider_key_in_default_profile(&provider).ok()
            };
            let settings = provider_settings.get(provider.as_str());
            translate_with_external_provider(&provider, &request, api_key.as_deref(), settings)
                .await
        };

        match translated_result {
            Ok(translated_text) => {
                return Ok(TranslationSegmentResponse {
                    translated_text,
                    provider_used: provider,
                    fallback_chain,
                });
            }
            Err(error) => {
                provider_errors.push(format!("{provider}: {error}"));
            }
        }
    }

    if provider_errors.is_empty() {
        return Err("No available translation provider in fallback chain".to_string());
    }

    Err(format!(
        "Translation failed after provider fallback attempts: {}",
        provider_errors.join(" | ")
    ))
}

#[tauri::command]
#[specta::specta]
pub async fn get_ollama_available_tags(app: AppHandle) -> Result<Vec<String>, String> {
    let preferences = load_preferences_sync(&app).unwrap_or_default();
    let provider_settings = preferences
        .reader_translation_provider_settings
        .get(OLLAMA_PROVIDER);
    let endpoint = resolve_provider_endpoint(
        provider_settings.and_then(|s| s.base_url.as_deref()),
        OLLAMA_DEFAULT_BASE_URL,
        OLLAMA_TAGS_PATH,
    );
    let api_key = get_provider_key_in_default_profile(OLLAMA_PROVIDER).ok();
    let timeout = Duration::from_millis(resolve_provider_timeout_ms(provider_settings));

    log::info!(
        "ollama tags: GET {endpoint} | auth={}",
        if api_key.is_some() { "bearer" } else { "none" }
    );

    let client = reqwest::Client::new();
    let mut request = client.get(&endpoint).timeout(timeout);
    if let Some(key) = &api_key {
        request = request.bearer_auth(key);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Ollama tags request failed: {e}"))?;

    let status = response.status();
    log::info!("ollama tags: response status={}", status.as_u16());

    if !status.is_success() {
        return Err(format!(
            "Ollama tags request failed with status {}: {}",
            status.as_u16(),
            endpoint
        ));
    }

    let body: OllamaTagsApiResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama tags response: {e}"))?;

    let names: Vec<String> = body.models.into_iter().map(|m| m.name).collect();
    log::info!("ollama tags: found {} models", names.len());
    Ok(names)
}

#[tauri::command]
#[specta::specta]
pub async fn get_provider_available_models(
    app: AppHandle,
    provider: String,
) -> Result<Vec<String>, String> {
    let preferences = load_preferences_sync(&app).unwrap_or_default();
    let provider_settings = preferences
        .reader_translation_provider_settings
        .get(&provider);
    let base_url_override = provider_settings.and_then(|s| s.base_url.as_deref());
    let timeout = Duration::from_millis(resolve_provider_timeout_ms(provider_settings));
    let api_key = get_provider_key_in_default_profile(&provider).ok();
    let provider_str = provider.as_str();

    match provider_str {
        OLLAMA_PROVIDER => {
            let endpoint = resolve_provider_endpoint(
                base_url_override,
                OLLAMA_DEFAULT_BASE_URL,
                OLLAMA_TAGS_PATH,
            );
            log::info!(
                "provider models (ollama): GET {endpoint} | auth={}",
                if api_key.is_some() { "bearer" } else { "none" }
            );
            let client = reqwest::Client::new();
            let mut req = client.get(&endpoint).timeout(timeout);
            if let Some(key) = &api_key {
                req = req.bearer_auth(key);
            }
            let response = req
                .send()
                .await
                .map_err(|e| format!("Request failed: {e}"))?;
            let status = response.status();
            if !status.is_success() {
                return Err(format!("Request failed with status {}", status.as_u16()));
            }
            let body: OllamaTagsApiResponse = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {e}"))?;
            let names: Vec<String> = body.models.into_iter().map(|m| m.name).collect();
            log::info!("provider models (ollama): found {} models", names.len());
            Ok(names)
        }
        GEMINI_PROVIDER => {
            let key = api_key.ok_or_else(|| "Gemini API key is required".to_string())?;
            let base_url = base_url_override
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .unwrap_or(GEMINI_DEFAULT_BASE_URL);
            let normalized = base_url.trim_end_matches('/');
            let path = GEMINI_MODELS_PATH.trim_start_matches('/');
            let endpoint = format!("{normalized}/{path}?key={key}");
            log::info!("provider models (gemini): GET (key omitted from log)");
            let client = reqwest::Client::new();
            let response = client
                .get(&endpoint)
                .timeout(timeout)
                .send()
                .await
                .map_err(|e| format!("Request failed: {e}"))?;
            let status = response.status();
            if !status.is_success() {
                return Err(format!("Request failed with status {}", status.as_u16()));
            }
            let body: GeminiModelsApiResponse = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {e}"))?;
            let names: Vec<String> = body
                .models
                .into_iter()
                .map(|m| {
                    m.name
                        .strip_prefix("models/")
                        .unwrap_or(&m.name)
                        .to_string()
                })
                .collect();
            log::info!("provider models (gemini): found {} models", names.len());
            Ok(names)
        }
        _ => {
            let key = api_key.ok_or_else(|| format!("API key for '{provider}' is required"))?;
            let (default_base_url, models_path) = match provider_str {
                OPENAI_PROVIDER => (OPENAI_DEFAULT_BASE_URL, OPENAI_COMPATIBLE_MODELS_PATH),
                ANTHROPIC_PROVIDER => (ANTHROPIC_DEFAULT_BASE_URL, OPENAI_COMPATIBLE_MODELS_PATH),
                "openrouter" => (OPENROUTER_DEFAULT_BASE_URL, OPENROUTER_MODELS_PATH),
                "glm" => (GLM_DEFAULT_BASE_URL, GLM_MODELS_PATH),
                "kimi" => (KIMI_DEFAULT_BASE_URL, OPENAI_COMPATIBLE_MODELS_PATH),
                "minimax" => (MINIMAX_DEFAULT_BASE_URL, OPENAI_COMPATIBLE_MODELS_PATH),
                "qwen" => (QWEN_DEFAULT_BASE_URL, OPENAI_COMPATIBLE_MODELS_PATH),
                "deepseek" => (DEEPSEEK_DEFAULT_BASE_URL, OPENAI_COMPATIBLE_MODELS_PATH),
                _ => {
                    return Err(format!(
                        "Provider '{provider}' does not support model listing"
                    ))
                }
            };
            let endpoint =
                resolve_provider_endpoint(base_url_override, default_base_url, models_path);
            log::info!("provider models ({provider}): GET {endpoint} | auth=bearer");
            let client = reqwest::Client::new();
            let mut req = client.get(&endpoint).timeout(timeout);
            if provider_str == ANTHROPIC_PROVIDER {
                req = req
                    .header("x-api-key", &key)
                    .header("anthropic-version", "2023-06-01");
            } else {
                req = req.bearer_auth(&key);
            }
            let response = req
                .send()
                .await
                .map_err(|e| format!("Request failed: {e}"))?;
            let status = response.status();
            if !status.is_success() {
                return Err(format!("Request failed with status {}", status.as_u16()));
            }
            let body: OpenAiModelsApiResponse = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {e}"))?;
            let names: Vec<String> = body.data.into_iter().map(|m| m.id).collect();
            log::info!("provider models ({provider}): found {} models", names.len());
            Ok(names)
        }
    }
}

// ── Streaming translation ──

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TranslationStreamEvent {
    /// Unique stream ID to correlate chunks with the request.
    pub stream_id: String,
    /// "delta" for text chunks, "done" for completion, "error" for failure.
    pub event: String,
    /// Text delta (for "delta" events) or full accumulated text (for "done").
    pub text: String,
    /// Provider name (set on "done").
    pub provider_used: Option<String>,
}

fn emit_translation_delta(app: &AppHandle, stream_id: &str, delta: &str) {
    let _ = app.emit(
        "translation-stream",
        TranslationStreamEvent {
            stream_id: stream_id.to_string(),
            event: "delta".to_string(),
            text: delta.to_string(),
            provider_used: None,
        },
    );
}

/// Streaming version of translate_reader_segment for LLM providers.
/// Non-LLM providers (Apple, DeepL, Google) emit the full result as a single chunk.
#[tauri::command]
#[specta::specta]
pub async fn translate_reader_segment_stream(
    app: AppHandle,
    request: TranslationSegmentRequest,
    stream_id: String,
) -> Result<(), String> {
    validate_translation_segment_request(&request)?;

    let preferences = load_preferences_sync(&app).unwrap_or_default();
    let provider_settings = &preferences.reader_translation_provider_settings;
    let apple_available = is_apple_translation_available();

    // If forced_provider is set, skip the fallback chain
    if let Some(ref forced) = request.forced_provider {
        let provider = normalize_provider_identifier(forced)
            .ok_or_else(|| format!("Unknown forced provider: {forced}"))?;

        let available = if provider == APPLE_BUILT_IN_PROVIDER {
            apple_available
        } else if !provider_has_runtime_settings(&provider, provider_settings) {
            false
        } else if !provider_requires_key(&provider) {
            true
        } else {
            provider_has_key_in_default_profile(&provider)?
        };

        if !available {
            return Err(format!("Forced provider '{provider}' is not available"));
        }

        return translate_segment_stream_with_provider(
            &app,
            &stream_id,
            &provider,
            &request,
            provider_settings,
            apple_available,
        )
        .await;
    }

    let provider_attempts = collect_provider_attempts(&request, apple_available);
    if provider_attempts.is_empty() {
        return Err("No translation provider configured".to_string());
    }

    let mut provider_errors: Vec<String> = Vec::new();

    for provider in provider_attempts {
        let available = if provider == APPLE_BUILT_IN_PROVIDER {
            apple_available
        } else if !provider_has_runtime_settings(&provider, provider_settings) {
            false
        } else if !provider_requires_key(&provider) {
            true
        } else {
            match provider_has_key_in_default_profile(&provider) {
                Ok(v) => v,
                Err(e) => {
                    provider_errors.push(format!("{provider}: {e}"));
                    continue;
                }
            }
        };

        if !available {
            continue;
        }

        match translate_segment_stream_with_provider(
            &app,
            &stream_id,
            &provider,
            &request,
            provider_settings,
            apple_available,
        )
        .await
        {
            Ok(()) => return Ok(()),
            Err(e) => {
                provider_errors.push(format!("{provider}: {e}"));
            }
        }
    }

    let error_msg = if provider_errors.is_empty() {
        "No available translation provider in fallback chain".to_string()
    } else {
        format!(
            "Translation failed after provider fallback attempts: {}",
            provider_errors.join(" | ")
        )
    };

    let _ = app.emit(
        "translation-stream",
        TranslationStreamEvent {
            stream_id,
            event: "error".to_string(),
            text: error_msg.clone(),
            provider_used: None,
        },
    );

    Err(error_msg)
}

async fn translate_segment_stream_with_provider(
    app: &AppHandle,
    stream_id: &str,
    provider: &str,
    request: &TranslationSegmentRequest,
    provider_settings: &HashMap<String, ReaderTranslationProviderSettings>,
    apple_available: bool,
) -> Result<(), String> {
    let settings = provider_settings.get(provider);

    // Non-LLM providers can't stream, so fall back to non-streaming + emit full result
    if !provider_is_llm(provider) {
        let translated_text = if provider == APPLE_BUILT_IN_PROVIDER {
            if !apple_available {
                return Err("Apple built-in translation is not available".to_string());
            }
            translate_with_apple_built_in(request).map(|r| r.translated_text)
        } else if provider == DEEPL_PROVIDER {
            let key = get_provider_key_in_default_profile(provider)?;
            translate_with_deepl(request, &key, settings).await
        } else if provider == GOOGLE_TRANSLATE_PROVIDER {
            let key = get_provider_key_in_default_profile(provider)?;
            translate_with_google_translate(request, &key, settings).await
        } else {
            Err(format!("Provider '{provider}' does not support streaming"))
        }?;

        // Emit the full result as a single chunk + done
        emit_translation_delta(app, stream_id, &translated_text);
        let _ = app.emit(
            "translation-stream",
            TranslationStreamEvent {
                stream_id: stream_id.to_string(),
                event: "done".to_string(),
                text: translated_text,
                provider_used: Some(provider.to_string()),
            },
        );
        return Ok(());
    }

    // LLM providers — stream
    let api_key = if provider_requires_key(provider) {
        Some(get_provider_key_in_default_profile(provider)?)
    } else {
        get_provider_key_in_default_profile(provider).ok()
    };

    let system_prompt = resolve_llm_system_prompt(request, settings);
    let full_text = call_translation_llm_stream(
        app,
        stream_id,
        provider,
        &request.text,
        &system_prompt,
        api_key.as_deref(),
        settings,
    )
    .await?;

    let _ = app.emit(
        "translation-stream",
        TranslationStreamEvent {
            stream_id: stream_id.to_string(),
            event: "done".to_string(),
            text: full_text,
            provider_used: Some(provider.to_string()),
        },
    );

    Ok(())
}

async fn call_translation_llm_stream(
    app: &AppHandle,
    stream_id: &str,
    provider: &str,
    text: &str,
    system_prompt: &str,
    api_key: Option<&str>,
    settings: Option<&ReaderTranslationProviderSettings>,
) -> Result<String, String> {
    let model = settings
        .and_then(|v| v.model.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| format!("{provider} model is required"))?;
    let timeout = Duration::from_millis(resolve_provider_timeout_ms(settings));

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    match provider {
        OLLAMA_PROVIDER => {
            let endpoint = resolve_provider_endpoint(
                settings.and_then(|v| v.base_url.as_deref()),
                OLLAMA_DEFAULT_BASE_URL,
                OLLAMA_CHAT_PATH,
            );
            log::info!("translate-stream(ollama): POST {endpoint} | model={model}");

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

            let app_c = app.clone();
            let sid = stream_id.to_string();
            llm_stream::stream_ollama(response, &mut |delta| {
                emit_translation_delta(&app_c, &sid, delta);
            })
            .await
        }
        ANTHROPIC_PROVIDER => {
            let key = api_key.ok_or("Anthropic API key is missing")?;
            let endpoint = resolve_provider_endpoint(
                settings.and_then(|v| v.base_url.as_deref()),
                ANTHROPIC_DEFAULT_BASE_URL,
                "/v1/messages",
            );
            log::info!("translate-stream(anthropic): POST {endpoint} | model={model}");

            let payload = serde_json::json!({
                "model": model,
                "max_tokens": 4096,
                "stream": true,
                "system": system_prompt,
                "messages": [
                    { "role": "user", "content": text }
                ]
            });

            let response = client
                .post(&endpoint)
                .header("x-api-key", key)
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

            let app_c = app.clone();
            let sid = stream_id.to_string();
            llm_stream::stream_anthropic(response, &mut |delta| {
                emit_translation_delta(&app_c, &sid, delta);
            })
            .await
        }
        GEMINI_PROVIDER => {
            let key = api_key.ok_or("Gemini API key is missing")?;
            let base_url = settings
                .and_then(|v| v.base_url.as_deref())
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .unwrap_or(GEMINI_DEFAULT_BASE_URL);
            let endpoint = format!(
                "{}/v1beta/models/{model}:streamGenerateContent?key={key}&alt=sse",
                base_url.trim_end_matches('/')
            );
            log::info!("translate-stream(gemini): POST .../{model}:streamGenerateContent");

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

            let app_c = app.clone();
            let sid = stream_id.to_string();
            llm_stream::stream_gemini(response, &mut |delta| {
                emit_translation_delta(&app_c, &sid, delta);
            })
            .await
        }
        _ => {
            // OpenAI-compatible providers
            let key = api_key.ok_or_else(|| format!("{provider} API key is missing"))?;
            let default_base_url = match provider {
                "openai" => OPENAI_DEFAULT_BASE_URL,
                "openrouter" => OPENROUTER_DEFAULT_BASE_URL,
                "glm" => GLM_DEFAULT_BASE_URL,
                "kimi" => KIMI_DEFAULT_BASE_URL,
                "minimax" => MINIMAX_DEFAULT_BASE_URL,
                "qwen" => QWEN_DEFAULT_BASE_URL,
                "deepseek" => DEEPSEEK_DEFAULT_BASE_URL,
                _ => return Err(format!("Provider '{provider}' is not implemented")),
            };
            let endpoint = resolve_provider_endpoint(
                settings.and_then(|v| v.base_url.as_deref()),
                default_base_url,
                "/v1/chat/completions",
            );
            log::info!("translate-stream({provider}): POST {endpoint} | model={model}");

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
                .bearer_auth(key)
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("{provider} request failed: {e}"))?;
            let status = response.status();
            if !status.is_success() {
                let body = response.text().await.unwrap_or_default();
                return Err(format!("{provider} returned {}: {body}", status.as_u16()));
            }

            let app_c = app.clone();
            let sid = stream_id.to_string();
            llm_stream::stream_openai_compatible(response, &mut |delta| {
                emit_translation_delta(&app_c, &sid, delta);
            })
            .await
        }
    }
}

#[cfg(test)]
#[path = "translation.test.rs"]
mod tests;

#[cfg(test)]
#[path = "translation_router.test.rs"]
mod translation_router;
