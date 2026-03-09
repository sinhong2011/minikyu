import type { AppPreferences } from '@/lib/tauri-bindings';
import { usePreferences, useSavePreferences } from '@/services/preferences';

export function useGestureSettings() {
  const { data: preferences } = usePreferences();
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
    swipeLeftAction: preferences?.gesture_swipe_left_action ?? 'open_in_app_browser',
    swipeRightAction:
      preferences?.gesture_swipe_right_action === 'close_browser'
        ? 'toggle_read'
        : (preferences?.gesture_swipe_right_action ?? 'toggle_read'),
    pullTopAction: preferences?.gesture_pull_top_action ?? 'prev_article',
    pullBottomAction: preferences?.gesture_pull_bottom_action ?? 'next_article',
    swipeThreshold: preferences?.gesture_swipe_threshold ?? 250,
    setSwipeLeftAction: (action: string) => updateSetting('gesture_swipe_left_action', action),
    setSwipeRightAction: (action: string) => updateSetting('gesture_swipe_right_action', action),
    setPullTopAction: (action: string) => updateSetting('gesture_pull_top_action', action),
    setPullBottomAction: (action: string) => updateSetting('gesture_pull_bottom_action', action),
    setSwipeThreshold: (threshold: number) => updateSetting('gesture_swipe_threshold', threshold),
  };
}
