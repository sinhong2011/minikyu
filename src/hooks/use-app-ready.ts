import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

/** Minimum time (ms) splash screen must display to ensure entrance animation completes */
const MIN_SPLASH_DURATION_MS = 150;

/** Maximum time (ms) to wait before forcing ready state, prevents permanent splash hang */
const SAFETY_TIMEOUT_MS = 2_500;

/**
 * Tracks app initialization readiness. Returns true when all conditions are met:
 * 1. `database-ready` Tauri event received
 * 2. `app-init-complete` window event received (language + menu built)
 * 3. Minimum splash floor elapsed (animation floor)
 *
 * Includes a safety timeout that forces readiness if signals don't arrive.
 */
export function useAppReady(): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let dbReady = false;
    let initReady = false;
    let timerReady = false;

    const check = () => {
      if (dbReady && initReady && timerReady) {
        logger.info('App ready — all initialization signals received');
        setIsReady(true);
      }
    };

    const unlistenPromise = listen('database-ready', () => {
      logger.debug('Splash: database-ready received');
      dbReady = true;
      check();
    });

    const handleInit = () => {
      logger.debug('Splash: app-init-complete received');
      initReady = true;
      check();
    };
    window.addEventListener('app-init-complete', handleInit);

    const timer = setTimeout(() => {
      timerReady = true;
      check();
    }, MIN_SPLASH_DURATION_MS);

    const safetyTimer = setTimeout(() => {
      if (!dbReady || !initReady) {
        logger.warn('Splash: safety timeout reached, forcing ready state', {
          dbReady,
          initReady,
          timerReady,
        });
        setIsReady(true);
      }
    }, SAFETY_TIMEOUT_MS);

    return () => {
      unlistenPromise.then((fn) => fn());
      window.removeEventListener('app-init-complete', handleInit);
      clearTimeout(timer);
      clearTimeout(safetyTimer);
    };
  }, []);

  return isReady;
}
