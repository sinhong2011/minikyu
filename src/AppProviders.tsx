import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './components/ThemeProvider';
import { initializeLanguage } from './i18n/language-init';
import { initializeCommandSystem } from './lib/commands';
import { logger } from './lib/logger';
import { buildAppMenu, setupMenuLanguageListener } from './lib/menu';
import { cleanupOldFiles } from './lib/recovery';
import { commands } from './lib/tauri-bindings';
import { useAutoReconnect } from './services/miniflux/auth';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const { handleAutoReconnect } = useAutoReconnect();

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

        window.dispatchEvent(new Event('app-init-complete'));
        logger.debug('Dispatched app-init-complete event');
      } catch (error) {
        logger.warn('Failed to initialize language or menu', { error });
        window.dispatchEvent(new Event('app-init-complete'));
      }
    };

    initLanguageAndMenu();

    cleanupOldFiles().catch((error) => {
      logger.warn('Failed to cleanup old recovery files', { error });
    });

    // Attempt auto-reconnect on app startup
    handleAutoReconnect().catch((error) => {
      logger.error('Auto-reconnect failed', { error });
    });

    logger.info('App environment', {
      isDev: import.meta.env.DEV,
      mode: import.meta.env.MODE,
    });
  }, [handleAutoReconnect]);

  return (
    <ErrorBoundary>
      <ThemeProvider>{children}</ThemeProvider>
    </ErrorBoundary>
  );
}
