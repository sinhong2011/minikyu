use crate::types::TranslationCacheEntry;
use crate::AppState;
use sqlx::Row;
use tauri::Manager;

#[tauri::command]
#[specta::specta]
pub async fn get_translation_cache_entry(
    app: tauri::AppHandle,
    key: String,
) -> Result<Option<TranslationCacheEntry>, String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    let row = sqlx::query(
        "SELECT translated_text, provider_used, cached_at FROM translation_cache WHERE cache_key = ?",
    )
    .bind(&key)
    .fetch_optional(&pool)
    .await
    .map_err(|e| format!("{e}"))?;

    match row {
        Some(r) => Ok(Some(TranslationCacheEntry {
            translated_text: r.get("translated_text"),
            provider_used: r.get("provider_used"),
            cached_at: r.get("cached_at"),
        })),
        None => Ok(None),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn set_translation_cache_entry(
    app: tauri::AppHandle,
    key: String,
    entry: TranslationCacheEntry,
) -> Result<(), String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    sqlx::query(
        r#"
        INSERT INTO translation_cache (cache_key, translated_text, provider_used, cached_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
            translated_text = excluded.translated_text,
            provider_used = excluded.provider_used,
            cached_at = excluded.cached_at
        "#,
    )
    .bind(&key)
    .bind(&entry.translated_text)
    .bind(&entry.provider_used)
    .bind(entry.cached_at)
    .execute(&pool)
    .await
    .map_err(|e| format!("{e}"))?;

    Ok(())
}
