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
          quick_pane_shortcut: null,
          language: null,
          close_behavior: 'minimize_to_tray',
          show_tray_icon: true,
          start_minimized: false,
          reader_font_size: 16,
          reader_line_width: 65,
          reader_line_height: 1.75,
          reader_font_family: 'sans-serif',
          reader_theme: 'default',
          reader_code_theme: 'auto',
          reader_chinese_conversion: 's2tw',
          reader_bionic_reading: false,
          reader_status_bar: false,
          reader_focus_mode: false,
          reader_custom_conversions: [],
          reader_translation_display_mode: 'bilingual',
          reader_translation_trigger_mode: 'manual',
          reader_translation_route_mode: 'engine_first',
          reader_translation_target_language: null,
          reader_translation_primary_engine: 'deepl',
          reader_translation_engine_fallbacks: ['google_translate'],
          reader_translation_llm_fallbacks: [],
          reader_translation_apple_fallback_enabled: false,
          reader_translation_provider_settings: {},
          reader_translation_auto_enabled: false,
          reader_translation_exclusions: {},
          image_download_path: null,
          video_download_path: null,
          ai_summary_auto_enabled: false,
          ai_summary_custom_prompt: null,
          ai_summary_provider: null,
          ai_summary_model: null,
          ai_summary_max_text_length: 100000,
          player_display_mode: 'FloatingWindow',
          keyboard_shortcuts: {},
          log_level: 'info',
          time_format: '24h',
          sync_interval: 15,
          auto_check_updates: true,
          gesture_swipe_left_action: 'open_in_app_browser',
          gesture_swipe_right_action: 'toggle_read',
          gesture_pull_top_action: 'prev_article',
          gesture_pull_bottom_action: 'next_article',
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
