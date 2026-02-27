// Command system exports

export * from '../../hooks/use-command-context';
export * from './registry';

import { articleCommands } from './article-commands';
import { feedCommands } from './feed-commands';
import { helpCommands } from './help-commands';
import { navigationCommands } from './navigation-commands';
import { notificationCommands } from './notification-commands';
import { podcastCommands } from './podcast-commands';
import { registerCommands } from './registry';
import { translationCommands } from './translation-commands';
import { viewCommands } from './view-commands';
import { windowCommands } from './window-commands';

/**
 * Initialize the command system by registering all commands.
 * This should be called once during app initialization.
 */
export function initializeCommandSystem(): void {
  registerCommands(navigationCommands);
  registerCommands(windowCommands);
  registerCommands(notificationCommands);
  registerCommands(feedCommands);
  registerCommands(articleCommands);
  registerCommands(translationCommands);
  registerCommands(podcastCommands);
  registerCommands(viewCommands);
  registerCommands(helpCommands);

  if (import.meta.env.DEV) {
    console.log('Command system initialized');
  }
}

export {
  navigationCommands,
  windowCommands,
  notificationCommands,
  feedCommands,
  articleCommands,
  translationCommands,
  podcastCommands,
  viewCommands,
  helpCommands,
};
