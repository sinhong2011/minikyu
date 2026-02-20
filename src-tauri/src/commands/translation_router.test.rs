use super::{route_translation_provider, translate_with_provider_chain, TranslationSegmentRequest};

#[test]
fn engine_first_tries_selected_engine_first() {
    let request = TranslationSegmentRequest {
        text: "Hello world".to_string(),
        source_language: Some("en".to_string()),
        target_language: "zh-CN".to_string(),
        route_mode: "engine_first".to_string(),
        primary_engine: Some("deepl".to_string()),
        engine_fallbacks: vec!["google_translate".to_string()],
        llm_fallbacks: vec!["openai".to_string()],
        apple_fallback_enabled: true,
    };

    let mut attempts = Vec::new();
    let decision = route_translation_provider(&request, true, |provider| {
        attempts.push(provider.to_string());
        Ok(provider == "deepl")
    })
    .expect("Expected provider routing to succeed");

    assert_eq!(decision.provider_used, "deepl");
    assert_eq!(decision.fallback_chain, vec!["deepl".to_string()]);
    assert_eq!(attempts.first(), Some(&"deepl".to_string()));
}

#[test]
fn on_engine_failure_and_apple_enabled_chain_skips_apple_provider() {
    let request = TranslationSegmentRequest {
        text: "Hello world".to_string(),
        source_language: Some("en".to_string()),
        target_language: "zh-CN".to_string(),
        route_mode: "engine_first".to_string(),
        primary_engine: Some("deepl".to_string()),
        engine_fallbacks: vec!["google_translate".to_string()],
        llm_fallbacks: vec!["openai".to_string()],
        apple_fallback_enabled: true,
    };

    let decision = route_translation_provider(&request, true, |provider| Ok(provider == "openai"))
        .expect("Expected provider routing to succeed");

    assert_eq!(decision.provider_used, "openai");
    assert_eq!(
        decision.fallback_chain,
        vec![
            "deepl".to_string(),
            "google_translate".to_string(),
            "openai".to_string()
        ]
    );
}

#[test]
fn if_apple_unavailable_first_llm_fallback_is_attempted() {
    let request = TranslationSegmentRequest {
        text: "Hello world".to_string(),
        source_language: Some("en".to_string()),
        target_language: "zh-CN".to_string(),
        route_mode: "engine_first".to_string(),
        primary_engine: Some("deepl".to_string()),
        engine_fallbacks: vec!["google_translate".to_string()],
        llm_fallbacks: vec!["openai".to_string(), "anthropic".to_string()],
        apple_fallback_enabled: true,
    };

    let decision = route_translation_provider(&request, false, |provider| Ok(provider == "openai"))
        .expect("Expected provider routing to succeed");

    assert_eq!(decision.provider_used, "openai");
    assert_eq!(
        decision.fallback_chain,
        vec![
            "deepl".to_string(),
            "google_translate".to_string(),
            "openai".to_string()
        ]
    );
}

#[test]
fn apple_failure_falls_back_to_next_available_provider() {
    let request = TranslationSegmentRequest {
        text: "Hello world".to_string(),
        source_language: Some("en".to_string()),
        target_language: "zh-CN".to_string(),
        route_mode: "engine_first".to_string(),
        primary_engine: None,
        engine_fallbacks: vec![],
        llm_fallbacks: vec!["openai".to_string()],
        apple_fallback_enabled: true,
    };

    let response = translate_with_provider_chain(
        &request,
        vec!["openai".to_string()],
        |_| Ok(true),
        |_provider, _request| Ok("你好世界".to_string()),
    )
    .expect("Expected provider chain to fallback to openai");

    assert_eq!(response.provider_used, "openai");
    assert_eq!(response.translated_text, "你好世界");
    assert_eq!(response.fallback_chain, vec!["openai".to_string()]);
}
