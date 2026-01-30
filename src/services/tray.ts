/**
 * Tray icon service for frontend integration
 *
 * Provides TanStack Query hooks and utilities for managing the system tray icon
 * from the React frontend.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { commands, type TrayIconState } from '@/lib/tauri-bindings';

// Query keys for tray operations
export const trayQueryKeys = {
  all: ['tray'] as const,
  state: () => [...trayQueryKeys.all, 'state'] as const,
  visibility: () => [...trayQueryKeys.all, 'visibility'] as const,
};

/**
 * Hook to get the current tray icon state
 */
export function useTrayState() {
  return useQuery({
    queryKey: trayQueryKeys.state(),
    queryFn: async (): Promise<TrayIconState> => {
      logger.debug('Getting tray state');
      return await commands.trayGetState();
    },
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to check if the main window is visible
 */
export function useWindowVisibility() {
  return useQuery({
    queryKey: trayQueryKeys.visibility(),
    queryFn: async (): Promise<boolean> => {
      logger.debug('Checking window visibility');
      const result = await commands.trayIsWindowVisible();
      if (result.status === 'error') {
        logger.error('Failed to check window visibility', {
          error: result.error,
        });
        return true; // Default to visible on error
      }
      return result.data;
    },
    staleTime: 1000, // 1 second - visibility changes frequently
  });
}

/**
 * Hook to show the main window
 */
export function useShowWindow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      logger.debug('Showing main window');
      const result = await commands.trayShowWindow();
      if (result.status === 'error') {
        logger.error('Failed to show window', { error: result.error });
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      // Invalidate visibility query
      queryClient.setQueryData(trayQueryKeys.visibility(), true);
    },
  });
}

/**
 * Hook to hide the main window
 */
export function useHideWindow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      logger.debug('Hiding main window');
      const result = await commands.trayHideWindow();
      if (result.status === 'error') {
        logger.error('Failed to hide window', { error: result.error });
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      // Invalidate visibility query
      queryClient.setQueryData(trayQueryKeys.visibility(), false);
    },
  });
}

/**
 * Hook to toggle main window visibility
 */
export function useToggleWindow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      logger.debug('Toggling main window visibility');
      const result = await commands.trayToggleWindow();
      if (result.status === 'error') {
        logger.error('Failed to toggle window', { error: result.error });
        throw new Error(result.error);
      }
    },
    onSuccess: async () => {
      // Refetch visibility after toggle
      await queryClient.invalidateQueries({
        queryKey: trayQueryKeys.visibility(),
      });
    },
  });
}

/**
 * Hook to update the tray icon state
 */
export function useSetTrayIconState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (state: TrayIconState) => {
      logger.debug('Setting tray icon state', { state });
      const result = await commands.traySetIconState(state);
      if (result.status === 'error') {
        logger.error('Failed to set tray icon state', { error: result.error });
        throw new Error(result.error);
      }
    },
    onSuccess: (_, state) => {
      // Update cache
      queryClient.setQueryData(trayQueryKeys.state(), state);
    },
  });
}

/**
 * Hook to update the tray tooltip
 */
export function useSetTrayTooltip() {
  return useMutation({
    mutationFn: async (tooltip: string) => {
      logger.debug('Setting tray tooltip', { tooltip });
      const result = await commands.traySetTooltip(tooltip);
      if (result.status === 'error') {
        logger.error('Failed to set tray tooltip', { error: result.error });
        throw new Error(result.error);
      }
    },
  });
}

/**
 * Hook to listen for tray events from the backend
 *
 * @param onOpenPreferences - Callback when preferences menu item is clicked
 * @param onQuickAction - Callback when a quick action is triggered
 */
export function useTrayEventListeners(
  onOpenPreferences?: () => void,
  onQuickAction?: (action: string) => void
) {
  useEffect(() => {
    // Listen for open-preferences event from tray menu
    const unsubscribePreferences = listen('open-preferences', () => {
      logger.debug('Received open-preferences event from tray');
      onOpenPreferences?.();
    });

    // Listen for quick action events
    const unsubscribeQuickAction = listen<string>('tray-quick-action', (event) => {
      logger.debug('Received quick action event from tray', {
        action: event.payload,
      });
      onQuickAction?.(event.payload);
    });

    return () => {
      unsubscribePreferences.then((unsub) => unsub());
      unsubscribeQuickAction.then((unsub) => unsub());
    };
  }, [onOpenPreferences, onQuickAction]);
}

/**
 * Helper to set tray icon to notification state temporarily
 * Useful for showing alerts that auto-clear
 */
export function useTemporaryTrayNotification() {
  const setState = useSetTrayIconState();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (durationMs: number = 5000) => {
      // Set to notification state
      await setState.mutateAsync('notification');

      // Reset after duration
      setTimeout(() => {
        setState.mutate('normal');
        queryClient.setQueryData(trayQueryKeys.state(), 'normal');
      }, durationMs);
    },
  });
}
