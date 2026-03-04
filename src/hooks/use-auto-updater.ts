import { msg } from '@lingui/core/macro';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { logger } from '@/lib/logger';
import { checkForUpdate, downloadUpdate, installAndRelaunch } from '@/lib/updater';
import { useUpdaterStore } from '@/store/updater-store';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const INITIAL_DELAY_MS = 5_000; // 5 seconds after app load
const ERROR_RETRY_MS = 60 * 60 * 1000; // 1 hour

export function useAutoUpdater() {
  const status = useUpdaterStore((s) => s.status);
  const toastIdRef = useRef<string | number | undefined>(undefined);

  // Initial check + periodic interval
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      checkForUpdate();
    }, INITIAL_DELAY_MS);

    const interval = setInterval(() => {
      const currentStatus = useUpdaterStore.getState().status;
      // Don't re-check if already downloading/ready/installing
      if (currentStatus === 'idle' || currentStatus === 'up-to-date' || currentStatus === 'error') {
        checkForUpdate();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  // React to state changes with toasts
  useEffect(() => {
    const _ = i18n._.bind(i18n);

    if (status === 'available') {
      // Auto-start download when update is found
      downloadUpdate();
    }

    if (status === 'downloading') {
      const state = useUpdaterStore.getState();
      if (state.status === 'downloading') {
        const progressText = _(
          msg`Downloading update v${state.version}... ${String(state.progress)}%`
        );
        if (toastIdRef.current) {
          toast.loading(progressText, { id: toastIdRef.current });
        } else {
          toastIdRef.current = toast.loading(progressText, { duration: Number.POSITIVE_INFINITY });
        }
      }
    }

    if (status === 'ready') {
      const state = useUpdaterStore.getState();
      if (state.status === 'ready') {
        // Dismiss progress toast and show action toast
        if (toastIdRef.current) {
          toast.dismiss(toastIdRef.current);
          toastIdRef.current = undefined;
        }

        toast.info(_(msg`Update v${state.version} is ready`), {
          description: _(msg`Restart to apply the update.`),
          duration: Number.POSITIVE_INFINITY,
          action: {
            label: _(msg`Restart Now`),
            onClick: () => {
              installAndRelaunch().catch((error) => {
                logger.error('Relaunch failed', { error });
              });
            },
          },
          cancel: {
            label: _(msg`Later`),
            onClick: () => {
              // Dismissed — update applies on next natural restart
            },
          },
        });
      }
    }

    if (status === 'error') {
      // Dismiss any active progress toast
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = undefined;
      }

      // Schedule silent retry
      const retryTimer = setTimeout(() => {
        useUpdaterStore.getState().reset();
        checkForUpdate();
      }, ERROR_RETRY_MS);

      return () => clearTimeout(retryTimer);
    }
  }, [status]);
}
