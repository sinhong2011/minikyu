import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MainWindow } from './components/layout/MainWindow';
import { ThemeProvider } from './components/ThemeProvider';
import { useAccountInitialization } from './hooks/use-account-initialization';
import { useAutoUpdater } from './hooks/use-auto-updater';
import { useCloudSyncAutoPull } from './hooks/use-cloud-sync-auto-pull';
import { availableLanguages } from './i18n';
import { initializeLanguage } from './i18n/language-init';
import { initializeCommandSystem } from './lib/commands';
import { logger } from './lib/logger';
import { buildAppMenu, setupMenuLanguageListener } from './lib/menu';
import { cleanupOldFiles } from './lib/recovery';
import { commands } from './lib/tauri-bindings';

function App() {
  useAccountInitialization();
  useAutoUpdater();
  useCloudSyncAutoPull();

  // Initialize command system and cleanup on app startup
  useEffect(() => {
    logger.info('🚀 Frontend application starting up');
    initializeCommandSystem();
    logger.debug('Command system initialized');

    // Initialize language based on saved preference or system locale
    const initLanguageAndMenu = async () => {
      try {
        // Load preferences to get saved language
        const result = await commands.loadPreferences();
        const savedLanguage = result.status === 'ok' ? result.data.language : null;

        // Initialize language (will use system locale if no preference)
        await initializeLanguage(savedLanguage);

        // Build the application menu with the initialized language
        await buildAppMenu();
        logger.debug('Application menu built');
        setupMenuLanguageListener();
      } catch (error) {
        logger.warn('Failed to initialize language or menu', { error });
      }
    };

    initLanguageAndMenu();

    // Clean up old recovery files on startup
    cleanupOldFiles().catch((error) => {
      logger.warn('Failed to cleanup old recovery files', { error });
    });

    logger.info('App environment', {
      isDev: import.meta.env.DEV,
      mode: import.meta.env.MODE,
    });

    // Listen for language switch commands from command palette
    const handleLanguageCommand = async (e: Event) => {
      const lang = (e as CustomEvent<string>).detail;
      if (!availableLanguages.includes(lang)) return;
      try {
        const { loadAndActivate } = await import('./i18n/config');
        await loadAndActivate(lang);
        await buildAppMenu();
        // Persist language preference
        const result = await commands.loadPreferences();
        if (result.status === 'ok') {
          await commands.savePreferences({ ...result.data, language: lang });
        }
      } catch (error) {
        logger.warn('Failed to switch language', { error });
      }
    };
    document.addEventListener('command:set-language', handleLanguageCommand);

    return () => {
      document.removeEventListener('command:set-language', handleLanguageCommand);
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <MainWindow />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
