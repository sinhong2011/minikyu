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
          reader_font_family: 'sans-serif',
          // biome-ignore lint/style/useNamingConvention: preferences field name
          image_download_path: null,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          video_download_path: null,
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
      toast.success('Preferences saved');
    },
  });
}
