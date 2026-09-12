import { createContext, useContext, type ReactNode } from 'react';

const ReaderActionBarSlotContext = createContext<HTMLElement | null>(null);

/** Footer host in the phone reading column so the action bar is in-flow. */
export function ReaderActionBarSlotProvider({
  slot,
  children,
}: {
  slot: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <ReaderActionBarSlotContext.Provider value={slot}>{children}</ReaderActionBarSlotContext.Provider>
  );
}

export function useReaderActionBarSlot() {
  return useContext(ReaderActionBarSlotContext);
}
