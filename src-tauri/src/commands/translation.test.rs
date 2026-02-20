use super::{
    delete_translation_provider_key, get_translation_provider_key_status,
    save_translation_provider_key,
};
use std::sync::OnceLock;

fn should_skip_keyring_tests() -> bool {
    static KEYRING_AVAILABLE: OnceLock<bool> = OnceLock::new();

    let keyring_available = KEYRING_AVAILABLE.get_or_init(|| {
        if std::env::var("CI").is_ok() || std::env::var("MINIKYU_SKIP_KEYRING_TESTS").is_ok() {
            return false;
        }

        let probe_key = format!("minikyu:translation:test-probe:{}", std::process::id());
        let probe_secret = format!("probe-{}", std::process::id());

        let entry = match keyring::Entry::new("minikyu", &probe_key) {
            Ok(entry) => entry,
            Err(_) => return false,
        };

        if entry.set_password(&probe_secret).is_err() {
            return false;
        }

        let _ = entry.delete_credential();
        true
    });

    !*keyring_available
}

#[tokio::test]
async fn save_translation_provider_key_sets_status_true() {
    if should_skip_keyring_tests() {
        println!(
            "Skipping save_translation_provider_key_sets_status_true: CI environment without keyring"
        );
        return;
    }

    let provider = "deepl";
    let profile = "translation-test-save-status";
    let api_key = "translation-test-key";

    let _ = delete_translation_provider_key(provider.to_string(), profile.to_string()).await;

    save_translation_provider_key(
        provider.to_string(),
        profile.to_string(),
        api_key.to_string(),
    )
    .await
    .expect("Expected save_translation_provider_key to succeed");

    let status = get_translation_provider_key_status(provider.to_string(), profile.to_string())
        .await
        .expect("Expected get_translation_provider_key_status to succeed");
    assert!(status);

    let _ = delete_translation_provider_key(provider.to_string(), profile.to_string()).await;
}

#[tokio::test]
async fn delete_translation_provider_key_sets_status_false() {
    if should_skip_keyring_tests() {
        println!(
            "Skipping delete_translation_provider_key_sets_status_false: CI environment without keyring"
        );
        return;
    }

    let provider = "google_translate";
    let profile = "translation-test-delete-status";
    let api_key = "translation-test-key";

    save_translation_provider_key(
        provider.to_string(),
        profile.to_string(),
        api_key.to_string(),
    )
    .await
    .expect("Expected save_translation_provider_key to succeed");

    delete_translation_provider_key(provider.to_string(), profile.to_string())
        .await
        .expect("Expected delete_translation_provider_key to succeed");

    let status = get_translation_provider_key_status(provider.to_string(), profile.to_string())
        .await
        .expect("Expected get_translation_provider_key_status to succeed");
    assert!(!status);
}

#[tokio::test]
async fn get_translation_provider_key_status_unknown_provider_profile_returns_false() {
    if should_skip_keyring_tests() {
        println!(
            "Skipping get_translation_provider_key_status_unknown_provider_profile_returns_false: CI environment without keyring"
        );
        return;
    }

    let status = get_translation_provider_key_status(
        "unknown_provider".to_string(),
        "unknown_profile".to_string(),
    )
    .await
    .expect("Expected get_translation_provider_key_status to succeed");

    assert!(!status);
}

#[cfg(target_os = "macos")]
#[test]
fn apple_translation_helper_compiles() {
    if should_skip_keyring_tests() {
        println!("Skipping apple_translation_helper_compiles: CI environment without keyring");
        return;
    }

    let helper_path = super::ensure_apple_translation_helper()
        .expect("Expected Apple translation helper to compile successfully");
    assert!(helper_path.exists());
}

#[cfg(target_os = "macos")]
#[test]
fn apple_translation_error_mapping_is_user_actionable() {
    let unsupported =
        super::map_apple_translation_stderr("Apple Translation failed: does not support en -> xx.");
    assert_eq!(
        unsupported,
        "Apple built-in translation does not support this language pair"
    );

    let unable =
        super::map_apple_translation_stderr("Apple Translation failed: Unable to Translate");
    assert_eq!(
        unable,
        "Apple built-in translation could not translate this content"
    );
}

#[test]
fn deepl_language_code_normalization_maps_supported_variants() {
    assert_eq!(
        super::normalize_deepl_language_code("zh-CN"),
        Some("ZH".to_string())
    );
    assert_eq!(
        super::normalize_deepl_language_code("zh-TW"),
        Some("ZH".to_string())
    );
    assert_eq!(
        super::normalize_deepl_language_code("en"),
        Some("EN".to_string())
    );
    assert_eq!(
        super::normalize_deepl_language_code("fr"),
        Some("FR".to_string())
    );
    assert_eq!(super::normalize_deepl_language_code(""), None);
}

#[test]
fn deepl_endpoint_resolution_appends_translate_path() {
    assert_eq!(
        super::resolve_provider_endpoint(
            Some("https://api-free.deepl.com/v2"),
            super::DEEPL_DEFAULT_BASE_URL,
            super::DEEPL_TRANSLATE_PATH
        ),
        "https://api-free.deepl.com/v2/translate".to_string()
    );
    assert_eq!(
        super::resolve_provider_endpoint(
            Some("https://api-free.deepl.com/v2/translate"),
            super::DEEPL_DEFAULT_BASE_URL,
            super::DEEPL_TRANSLATE_PATH
        ),
        "https://api-free.deepl.com/v2/translate".to_string()
    );
    assert_eq!(
        super::resolve_provider_endpoint(
            None,
            super::DEEPL_DEFAULT_BASE_URL,
            super::DEEPL_TRANSLATE_PATH
        ),
        "https://api-free.deepl.com/v2/translate".to_string()
    );
}

#[test]
fn ollama_provider_does_not_require_api_key() {
    assert!(!super::provider_requires_key("ollama"));
    assert!(super::provider_requires_key("deepl"));
}

#[cfg(test)]
mod resolve_llm_system_prompt_tests {
    use super::super::{resolve_llm_system_prompt, TranslationSegmentRequest};
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
