import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './components/ThemeProvider';
import { initializeLanguage } from './i18n/language-init';
import { initializeCommandSystem } from './lib/commands';
import { logger } from './lib/logger';
import { buildAppMenu, setupMenuLanguageListener } from './lib/menu';
import { cleanupOldFiles } from './lib/recovery';
import { commands } from './lib/tauri-bindings';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  useEffect(() => {
    logger.info('🚀 Frontend application starting up');
    initializeCommandSystem();
    logger.debug('Command system initialized');

    const initLanguageAndMenu = async () => {
      try {
        const result = await commands.loadPreferences();
        const savedLanguage = result.status === 'ok' ? result.data.language : null;

        await initializeLanguage(savedLanguage);

        await buildAppMenu();
        logger.debug('Application menu built');
        setupMenuLanguageListener();
      } catch (error) {
        logger.warn('Failed to initialize language or menu', { error });
      }
    };

    initLanguageAndMenu();

    cleanupOldFiles().catch((error) => {
      logger.warn('Failed to cleanup old recovery files', { error });
    });

    logger.info('App environment', {
      isDev: import.meta.env.DEV,
      mode: import.meta.env.MODE,
    });

    const checkForUpdates = async () => {
      try {
        const update = await check();
        if (update) {
          logger.info(`Update available: ${update.version}`);

          const shouldUpdate = confirm(
            `Update available: ${update.version}\n\nWould you like to install this update now?`
          );

          if (shouldUpdate) {
            try {
              await update.downloadAndInstall((event) => {
                switch (event.event) {
                  case 'Started':
                    logger.info(`Downloading ${event.data.contentLength} bytes`);
                    break;
                  case 'Progress':
                    logger.info(`Downloaded: ${event.data.chunkLength} bytes`);
                    break;
                  case 'Finished':
                    logger.info('Download complete, installing...');
                    break;
                }
              });

              const shouldRestart = confirm(
                'Update completed successfully!\n\nWould you like to restart the app now to use the new version?'
              );

              if (shouldRestart) {
                await relaunch();
              }
            } catch (updateError) {
              logger.error(`Update installation failed: ${String(updateError)}`);
              alert(
                `Update failed: There was a problem with the automatic download.\n\n${String(updateError)}`
              );
            }
          }
        }
      } catch (checkError) {
        logger.error(`Update check failed: ${String(checkError)}`);
      }
    };

    const updateTimer = setTimeout(checkForUpdates, 5000);
    return () => clearTimeout(updateTimer);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>{children}</ThemeProvider>
    </ErrorBoundary>
  );
}
