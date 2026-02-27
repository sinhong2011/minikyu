import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useEffect, useMemo, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useCommandContext } from '@/hooks/use-command-context';
import { executeCommand, getAllCommands, getCommandById } from '@/lib/commands';
import { getRecentCommandIds, trackCommandUsage } from '@/lib/commands/recent-commands';
import type { AppCommand } from '@/lib/commands/types';
import { usePlayerStore } from '@/store/player-store';
import { useUIStore } from '@/store/ui-store';

const BASE_GROUP_ORDER = [
  'navigation',
  'feed',
  'article',
  'podcast',
  'view',
  'window',
  'help',
  'debug',
  'settings',
  'other',
];

function useContextAwareGroupOrder(): string[] {
  const hasSelectedEntry = useUIStore((s) => s.selectedEntryId !== undefined);
  const hasPodcast = usePlayerStore((s) => s.currentEntry !== null);

  return useMemo(() => {
    const order = [...BASE_GROUP_ORDER];

    // Boost relevant groups to the top based on context
    if (hasPodcast) {
      const idx = order.indexOf('podcast');
      if (idx > 0) {
        order.splice(idx, 1);
        order.splice(1, 0, 'podcast'); // After navigation
      }
    }
    if (hasSelectedEntry) {
      const idx = order.indexOf('article');
      if (idx > 0) {
        order.splice(idx, 1);
        order.splice(1, 0, 'article'); // After navigation (or after podcast)
      }
    }

    return order;
  }, [hasSelectedEntry, hasPodcast]);
}

export function CommandPalette() {
  const { _ } = useLingui();
  const commandPaletteOpen = useUIStore((state) => state.commandPaletteOpen);
  const setCommandPaletteOpen = useUIStore((state) => state.setCommandPaletteOpen);
  const toggleCommandPalette = useUIStore((state) => state.toggleCommandPalette);
  const commandContext = useCommandContext();
  const [search, setSearch] = useState('');
  const groupOrder = useContextAwareGroupOrder();

  const commands = getAllCommands(commandContext, search, _);
  const commandGroups = commands.reduce(
    (groups, command) => {
      const group = command.group || 'other';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(command);
      return groups;
    },
    {} as Record<string, AppCommand[]>
  );

  const sortedGroupEntries = Object.entries(commandGroups).sort(([a], [b]) => {
    const indexA = groupOrder.indexOf(a);
    const indexB = groupOrder.indexOf(b);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  // Recent commands — only shown when there's no search query
  const recentCommands = useMemo(() => {
    if (search.trim()) return [];
    const ids = getRecentCommandIds();
    return ids
      .map((id) => getCommandById(id))
      .filter((cmd): cmd is AppCommand => {
        if (!cmd) return false;
        return !cmd.isAvailable || cmd.isAvailable(commandContext);
      });
  }, [search, commandContext]);

  const handleCommandSelect = async (commandId: string) => {
    setCommandPaletteOpen(false);
    setSearch('');
    trackCommandUsage(commandId);

    const result = await executeCommand(commandId, commandContext);

    if (!result.success && result.error) {
      commandContext.showToast(result.error, 'error');
    }
  };

  const handleOpenChange = (open: boolean) => {
    setCommandPaletteOpen(open);
    if (!open) {
      setSearch('');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleCommandPalette();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleCommandPalette]);

  const getGroupLabel = (groupName: string): string => {
    switch (groupName) {
      case 'recent':
        return _(msg`Recent`);
      case 'navigation':
        return _(msg`Navigation`);
      case 'feed':
        return _(msg`Feed Management`);
      case 'article':
        return _(msg`Article`);
      case 'podcast':
        return _(msg`Podcast`);
      case 'view':
        return _(msg`View`);
      case 'debug':
        return _(msg`Debug`);
      case 'settings':
        return _(msg`Settings`);
      case 'window':
        return _(msg`Window`);
      case 'help':
        return _(msg`Help`);
      case 'other':
        return _(/* i18n: Command palette group label for miscellaneous commands */ msg`Others`);
      default:
        return groupName.charAt(0).toUpperCase() + groupName.slice(1);
    }
  };

  const renderCommandItem = (command: AppCommand, keyPrefix = '') => (
    <CommandItem
      key={`${keyPrefix}${command.id}`}
      value={[
        keyPrefix ? `${keyPrefix}${command.id}` : command.id,
        _(command.label),
        command.description ? _(command.description) : '',
        command.group ? getGroupLabel(command.group) : '',
        ...(command.keywords ?? []),
      ].join(' ')}
      onSelect={() => handleCommandSelect(command.id)}
    >
      {command.icon && <HugeiconsIcon icon={command.icon} className="mr-2 h-4 w-4 shrink-0" />}
      <div className="flex flex-col gap-0.5 overflow-hidden">
        <span className="truncate">{_(command.label)}</span>
        {command.description && (
          <span className="truncate text-xs text-muted-foreground">{_(command.description)}</span>
        )}
      </div>
      {command.shortcut && <CommandShortcut>{command.shortcut}</CommandShortcut>}
    </CommandItem>
  );

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={handleOpenChange}
      title={_(msg`Command Palette`)}
      description={_(msg`Type a command or search...`)}
      showCloseButton={false}
    >
      <CommandInput
        placeholder={_(msg`Type a command or search...`)}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>{_(msg`No results found.`)}</CommandEmpty>

        {recentCommands.length > 0 && (
          <>
            <CommandGroup heading={getGroupLabel('recent')}>
              {recentCommands.map((cmd) => renderCommandItem(cmd, 'recent-'))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {sortedGroupEntries.map(([groupName, groupCommands], index) => (
          <div key={groupName}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={getGroupLabel(groupName)}>
              {groupCommands.map((command) => renderCommandItem(command))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>

      {/* Action footer */}
      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
            {_(msg`Run`)}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">esc</kbd>
            {_(msg`Close`)}
          </span>
        </div>
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>
          {_(msg`Navigate`)}
        </span>
      </div>
    </CommandDialog>
  );
}

export default CommandPalette;
