use tauri_specta::{collect_commands, Builder};

pub fn generate_bindings() -> Builder<tauri::Wry> {
    use crate::commands::{
        accounts, counters, data, downloads, in_app_browser, miniflux, notifications,
        player_window, podcast, preferences, quick_pane, reading_state, recovery, summarize, sync,
        translation, translation_cache, tray,
    };

    Builder::<tauri::Wry>::new().commands(collect_commands![
        downloads::download_file,
        downloads::cancel_download,
        downloads::retry_download,
        downloads::get_downloads,
        downloads::get_downloads_from_db,
        downloads::get_downloaded_file_path,
        data::clear_local_data,
        preferences::greet,
        preferences::load_preferences,
        preferences::save_preferences,
        reading_state::load_last_reading,
        reading_state::save_last_reading,
        notifications::send_native_notification,
        recovery::save_emergency_data,
        recovery::load_emergency_data,
        recovery::cleanup_old_recovery_files,
        quick_pane::show_quick_pane,
        quick_pane::dismiss_quick_pane,
        quick_pane::toggle_quick_pane,
        quick_pane::get_default_quick_pane_shortcut,
        quick_pane::update_quick_pane_shortcut,
        tray::tray_show_window,
        tray::tray_hide_window,
        tray::tray_set_icon_state,
        tray::tray_set_tooltip,
        tray::tray_get_state,
        tray::tray_is_window_visible,
        tray::tray_quit_app,
        tray::handle_close_request,
        accounts::save_miniflux_account,
        accounts::get_miniflux_accounts,
        accounts::get_active_miniflux_account,
        accounts::switch_miniflux_account,
        accounts::delete_miniflux_account,
        accounts::auto_reconnect_miniflux,
        miniflux::miniflux_connect,
        miniflux::miniflux_disconnect,
        miniflux::miniflux_is_connected,
        miniflux::get_categories,
        miniflux::create_category,
        miniflux::update_category,
        miniflux::delete_category,
        miniflux::get_feeds,
        miniflux::get_category_feeds,
        miniflux::get_entries,
        miniflux::get_entries_list,
        miniflux::get_entry,
        miniflux::mark_entry_read,
        miniflux::mark_entries_read,
        miniflux::toggle_entry_read,
        miniflux::toggle_entry_star,
        miniflux::update_entry,
        miniflux::refresh_feed,
        miniflux::refresh_all_feeds,
        miniflux::create_feed,
        miniflux::update_feed,
        miniflux::delete_feed,
        miniflux::get_current_user,
        miniflux::get_users,
        miniflux::create_user,
        miniflux::update_user,
        miniflux::delete_user,
        miniflux::get_counters,
        miniflux::discover_subscriptions,
        miniflux::export_opml,
        miniflux::import_opml,
        miniflux::get_miniflux_version,
        miniflux::get_integrations,
        miniflux::fetch_entry_content,
        miniflux::flush_history,
        miniflux::get_feed_icon_data,
        sync::sync_miniflux,
        counters::get_unread_counts,
        in_app_browser::open_in_app_browser,
        in_app_browser::close_in_app_browser,
        in_app_browser::resize_browser_webview,
        in_app_browser::reload_browser_webview,
        in_app_browser::sync_browser_theme,
        summarize::summarize_article,
        summarize::summarize_article_stream,
        summarize::get_article_summary,
        summarize::save_article_summary,
        translation::save_translation_provider_key,
        translation::delete_translation_provider_key,
        translation::get_translation_provider_key_status,
        translation::translate_reader_segment,
        translation::translate_reader_segment_stream,
        translation::get_ollama_available_tags,
        translation::get_provider_available_models,
        translation_cache::get_translation_cache_entry,
        translation_cache::set_translation_cache_entry,
        player_window::show_player_window,
        player_window::hide_player_window,
        player_window::toggle_player_window,
        player_window::show_tray_popover,
        player_window::hide_tray_popover,
        player_window::toggle_tray_popover,
        podcast::get_entry_id_by_enclosure_url,
        podcast::get_podcast_feed_settings,
        podcast::update_podcast_feed_settings,
        podcast::save_podcast_progress,
        podcast::get_podcast_progress,
        podcast::get_podcast_progress_batch,
        podcast::mark_episode_completed,
        podcast::cleanup_played_episodes,
        podcast::seed_e2e_test_data,
    ])
}

/// Export TypeScript bindings to frontend.
/// Run with: cargo test export_bindings -- --ignored
#[cfg_attr(not(test), allow(dead_code))]
pub fn export_ts_bindings() {
    generate_bindings()
        .export(
            specta_typescript::Typescript::default()
                .bigint(specta_typescript::BigIntExportBehavior::String)
                .header("// @ts-nocheck\n// Auto-generated by tauri-specta. DO NOT EDIT.\n\n"),
            "../src/lib/bindings.ts",
        )
        .expect("Failed to export TypeScript bindings");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Generate TypeScript bindings file.
    /// This test is ignored by default so it doesn't run in CI.
    /// Run manually with: cargo test export_bindings -- --ignored
    #[test]
    #[ignore]
    fn export_bindings() {
        export_ts_bindings();
        println!("✓ TypeScript bindings exported to ../src/lib/bindings.ts");
    }
}
