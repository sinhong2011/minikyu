import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { type AppPreferences, commands } from '@/lib/tauri-bindings';

// Query keys for preferences
export const preferencesQueryKeys = {
  all: ['preferences'] as const,
  preferences: () => [...preferencesQueryKeys.all] as const,
};

// TanStack Query hooks following the architectural patterns
export function usePreferences() {
  return useQuery({
    queryKey: preferencesQueryKeys.preferences(),
    queryFn: async (): Promise<AppPreferences> => {
      logger.debug('Loading preferences from backend');
      const result = await commands.loadPreferences();

      if (result.status === 'error') {
        // Return defaults if preferences file doesn't exist yet
        logger.warn('Failed to load preferences, using defaults', {
          error: result.error,
        });
        return {
          theme: 'system',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          quick_pane_shortcut: null,
          language: null,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          close_behavior: 'minimize_to_tray',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          show_tray_icon: true,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          start_minimized: false,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_font_size: 16,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_line_width: 65,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_line_height: 1.75,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_font_family: 'sans-serif',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_theme: 'default',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_code_theme: 'auto',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_chinese_conversion: 's2tw',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_bionic_reading: false,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_status_bar: false,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_focus_mode: false,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_custom_conversions: [],
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_translation_display_mode: 'bilingual',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_translation_trigger_mode: 'manual',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_translation_route_mode: 'engine_first',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_translation_target_language: null,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_translation_primary_engine: 'deepl',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_translation_engine_fallbacks: ['google_translate'],
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_translation_llm_fallbacks: [],
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_translation_apple_fallback_enabled: false,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_translation_provider_settings: {},
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_translation_auto_enabled: false,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_translation_excluded_feed_ids: [],
          // biome-ignore lint/style/useNamingConvention: preferences field name
          reader_translation_excluded_category_ids: [],
          // biome-ignore lint/style/useNamingConvention: preferences field name
          image_download_path: null,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          video_download_path: null,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          ai_summary_auto_enabled: false,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          ai_summary_custom_prompt: null,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          ai_summary_provider: null,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          ai_summary_model: null,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          ai_summary_max_text_length: 100000,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          player_display_mode: 'FloatingWindow',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          keyboard_shortcuts: {},
          // biome-ignore lint/style/useNamingConvention: preferences field name
          log_level: 'info',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          time_format: '24h',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          sync_interval: 15,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          auto_check_updates: true,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          gesture_swipe_left_action: 'open_in_app_browser',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          gesture_swipe_right_action: 'close_browser',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          gesture_pull_top_action: 'prev_article',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          gesture_pull_bottom_action: 'next_article',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          gesture_swipe_threshold: 250,
        };
      }

      logger.info('Preferences loaded successfully', {
        preferences: result.data,
      });
      return result.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useSavePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: AppPreferences) => {
      logger.debug('Saving preferences to backend', { preferences });
      const result = await commands.savePreferences(preferences);

      if (result.status === 'error') {
        logger.error('Failed to save preferences', {
          error: result.error,
          preferences,
        });
        toast.error('Failed to save preferences', {
          description: result.error,
        });
        throw new Error(result.error);
      }

      logger.info('Preferences saved successfully');
    },
    onSuccess: (_, preferences) => {
      // Update the cache with the new preferences
      queryClient.setQueryData(preferencesQueryKeys.preferences(), preferences);
      logger.info('Preferences cache updated');
    },
  });
}
