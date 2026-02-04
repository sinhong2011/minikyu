import type { AppPreferences } from '@/lib/tauri-bindings';
import { usePreferences, useSavePreferences } from '@/services/preferences';

/**
 * Hook to manage reader settings, integrating with the global preferences system.
 */
export function useReaderSettings() {
  const { data: preferences, isLoading } = usePreferences();
  const { mutate: savePreferences } = useSavePreferences();

  const updateSetting = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    if (preferences) {
      savePreferences({
        ...preferences,
        [key]: value,
      });
    }
  };

  return {
    fontSize: preferences?.reader_font_size ?? 16,
    lineWidth: preferences?.reader_line_width ?? 65,
    fontFamily: preferences?.reader_font_family ?? 'sans-serif',
    isLoading,
    setFontSize: (size: number) => updateSetting('reader_font_size', size),
    setLineWidth: (width: number) => updateSetting('reader_line_width', width),
    setFontFamily: (family: string) => updateSetting('reader_font_family', family),
  };
}
