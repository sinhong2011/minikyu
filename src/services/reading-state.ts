import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { commands, type LastReadingEntry } from '@/lib/tauri-bindings';

export const readingStateQueryKeys = {
  all: ['reading-state'] as const,
  lastReading: () => [...readingStateQueryKeys.all, 'last'] as const,
};

export function useLastReadingEntry() {
  return useQuery({
    queryKey: readingStateQueryKeys.lastReading(),
    queryFn: async (): Promise<LastReadingEntry | null> => {
      logger.debug('Loading last reading entry from backend');
      const result = await commands.loadLastReading();

      if (result.status === 'error') {
        logger.warn('Failed to load last reading entry', {
          error: result.error,
        });
        return null;
      }

      if (result.data) {
        logger.info('Last reading entry loaded', {
          entryId: result.data.entry_id,
          timestamp: result.data.timestamp,
        });
      } else {
        logger.debug('No last reading entry found');
      }

      return result.data;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}

export function useSaveLastReading() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: LastReadingEntry) => {
      logger.debug('Saving last reading entry to backend', {
        entryId: entry.entry_id,
      });
      const result = await commands.saveLastReading(entry);

      if (result.status === 'error') {
        logger.error('Failed to save last reading entry', {
          error: result.error,
          entry,
        });
        throw new Error(result.error);
      }

      logger.info('Last reading entry saved successfully');
    },
    onSuccess: (_, entry) => {
      queryClient.setQueryData(readingStateQueryKeys.lastReading(), entry);
    },
  });
}
