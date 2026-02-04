import type { StateCreator, StoreMutatorIdentifier } from 'zustand';

type Logger = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  f: StateCreator<T, Mps, Mcs>,
  name?: string
) => StateCreator<T, Mps, Mcs>;

type LoggerImpl = <T>(f: StateCreator<T, [], []>, name?: string) => StateCreator<T, [], []>;

// Type-safe helper to call set with devtools action parameter
type DevtoolsSet<TState> = (
  partial: TState | Partial<TState> | ((state: TState) => TState | Partial<TState>),
  replace?: boolean | undefined,
  name?: string | undefined
) => void;

const loggerImpl: LoggerImpl = (f, name) => (set, get, api) => {
  type State = ReturnType<typeof get>;

  const loggedSet: DevtoolsSet<State> = (...args) => {
    const isDev = import.meta.env.DEV;

    if (isDev) {
      try {
        const prevState = get();
        const actionName = (args[2] as string | undefined) ?? 'anonymous';

        console.groupCollapsed(
          `%c${name || 'Store'} Action @ ${new Date().toLocaleTimeString()}`,
          'color: #ffffff; font-weight: bold;'
        );
        console.log('%cprev state', 'color: #9E9E9E; font-weight: bold;', prevState);
        console.log('%caction    ', 'color: #03A9F4; font-weight: bold;', actionName);
        console.log('%cpayload   ', 'color: #FF9800; font-weight: bold;', args[0]);
        (set as DevtoolsSet<State>)(...args);
        const nextState = get();
        console.log('%cnext state', 'color: #4CAF50; font-weight: bold;', nextState);
        console.groupEnd();
      } catch (e) {
        console.error('[Logger middleware] error:', e);
        (set as DevtoolsSet<State>)(...args);
      }
    } else {
      (set as DevtoolsSet<State>)(...args);
    }
  };

  return f(loggedSet, get, api);
};

export const logger = loggerImpl as unknown as Logger;
