import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commands } from '@/lib/tauri-bindings';

export const podcastQueryKeys = {
  all: ['podcast'] as const,
  progress: (entryId: string) => [...podcastQueryKeys.all, 'progress', entryId] as const,
  progressBatch: (ids: string[]) => [...podcastQueryKeys.all, 'progress', 'batch', ...ids] as const,
  feedSettings: (feedId: string) => [...podcastQueryKeys.all, 'feed-settings', feedId] as const,
};

/** Fetch podcast progress for a single entry */
export function usePodcastProgress(entryId: string | undefined) {
  return useQuery({
    queryKey: podcastQueryKeys.progress(entryId ?? ''),
    queryFn: async () => {
      const result = await commands.getPodcastProgress(entryId as string);
      if (result.status === 'ok') return result.data;
      throw new Error(result.error);
    },
    enabled: !!entryId,
    staleTime: 30_000,
  });
}

/** Fetch podcast progress for multiple entries */
export function usePodcastProgressBatch(entryIds: string[]) {
  return useQuery({
    queryKey: podcastQueryKeys.progressBatch(entryIds),
    queryFn: async () => {
      if (entryIds.length === 0) return [];
      const result = await commands.getPodcastProgressBatch(entryIds);
      if (result.status === 'ok') return result.data;
      throw new Error(result.error);
    },
    enabled: entryIds.length > 0,
    staleTime: 30_000,
  });
}

/** Fetch per-feed podcast settings */
export function usePodcastFeedSettings(feedId: string | undefined) {
  return useQuery({
    queryKey: podcastQueryKeys.feedSettings(feedId ?? ''),
    queryFn: async () => {
      const result = await commands.getPodcastFeedSettings(feedId as string);
      if (result.status === 'ok') return result.data;
      throw new Error(result.error);
    },
    enabled: !!feedId,
    staleTime: 60_000,
  });
}

/** Save podcast progress mutation (called debounced from player) */
export function useSavePodcastProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { entryId: string; currentTime: number; totalTime: number }) => {
      const result = await commands.savePodcastProgress(
        params.entryId,
        params.currentTime,
        params.totalTime
      );
      if (result.status === 'error') throw new Error(result.error);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: podcastQueryKeys.progress(variables.entryId),
      });
    },
  });
}

/** Update per-feed podcast settings */
export function useUpdatePodcastFeedSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      feedId: string;
      autoDownloadCount: number;
      playbackSpeed: number;
      autoCleanupDays: number;
    }) => {
      const result = await commands.updatePodcastFeedSettings(
        params.feedId,
        params.autoDownloadCount,
        params.playbackSpeed,
        params.autoCleanupDays
      );
      if (result.status === 'error') throw new Error(result.error);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: podcastQueryKeys.feedSettings(variables.feedId),
      });
    },
  });
}

/** Mark episode as completed */
export function useMarkEpisodeCompleted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      const result = await commands.markEpisodeCompleted(entryId);
      if (result.status === 'error') throw new Error(result.error);
    },
    onSuccess: (_, entryId) => {
      queryClient.invalidateQueries({
        queryKey: podcastQueryKeys.progress(entryId),
      });
    },
  });
}
