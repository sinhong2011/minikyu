use crate::types::TranslationCacheEntry;
use std::collections::HashMap;
use std::fs;
use tauri::Manager;

fn get_cache_file_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    Ok(data_dir.join("translation-cache.json"))
}

fn read_cache_file(path: &std::path::Path) -> HashMap<String, TranslationCacheEntry> {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_cache_file(
    path: &std::path::Path,
    cache: &HashMap<String, TranslationCacheEntry>,
) -> Result<(), String> {
    let json = serde_json::to_string_pretty(cache)
        .map_err(|e| format!("Failed to serialize cache: {e}"))?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create cache dir: {e}"))?;
    }
    fs::write(path, json).map_err(|e| format!("Failed to write cache file: {e}"))
}

#[tauri::command]
#[specta::specta]
pub fn get_translation_cache_entry(
    app: tauri::AppHandle,
    key: String,
) -> Result<Option<TranslationCacheEntry>, String> {
    let path = get_cache_file_path(&app)?;
    let cache = read_cache_file(&path);
    Ok(cache.get(&key).cloned())
}

#[tauri::command]
#[specta::specta]
pub fn set_translation_cache_entry(
    app: tauri::AppHandle,
    key: String,
    entry: TranslationCacheEntry,
) -> Result<(), String> {
    let path = get_cache_file_path(&app)?;
    let mut cache = read_cache_file(&path);
    cache.insert(key, entry);
    write_cache_file(&path, &cache)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_cache_file_returns_empty_for_nonexistent_path() {
        let path = std::path::PathBuf::from("/nonexistent/__translation_cache_test.json");
        let result = read_cache_file(&path);
        assert!(result.is_empty());
    }

    #[test]
    fn translation_cache_entry_serializes_and_deserializes() {
        let entry = TranslationCacheEntry {
            translated_text: "你好世界".to_string(),
            provider_used: "openai".to_string(),
            cached_at: 1_700_000_000,
        };
        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: TranslationCacheEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.translated_text, "你好世界");
        assert_eq!(deserialized.provider_used, "openai");
        assert_eq!(deserialized.cached_at, 1_700_000_000);
    }

    #[test]
    fn write_and_read_cache_roundtrip() {
        let path = std::env::temp_dir().join("__test_translation_cache_roundtrip.json");
        let mut cache = HashMap::new();
        cache.insert(
            "zh-TW:abc123".to_string(),
            TranslationCacheEntry {
                translated_text: "你好".to_string(),
                provider_used: "openai".to_string(),
                cached_at: 1_700_000_000,
            },
        );
        write_cache_file(&path, &cache).unwrap();
        let read_back = read_cache_file(&path);
        let _ = std::fs::remove_file(&path);

        assert_eq!(read_back.len(), 1);
        let entry = read_back.get("zh-TW:abc123").unwrap();
        assert_eq!(entry.translated_text, "你好");
    }
}
