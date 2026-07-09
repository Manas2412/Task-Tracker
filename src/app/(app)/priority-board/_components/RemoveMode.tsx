'use client';

import { createContext, useContext, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * Shared "remove mode" state for the Priority Board.
 *
 * The toggle button lives in the page header (below the search box) while the
 * per-card X buttons live inside the board — two separate client subtrees, so
 * the on/off state is shared through context rather than props.
 */
type RemoveModeValue = {
  removeMode: boolean;
  setRemoveMode: (v: boolean) => void;
};

const RemoveModeContext = createContext<RemoveModeValue | null>(null);

export function RemoveModeProvider({ children }: { children: React.ReactNode }) {
  const [removeMode, setRemoveMode] = useState(false);
  return (
    <RemoveModeContext.Provider value={{ removeMode, setRemoveMode }}>
      {children}
    </RemoveModeContext.Provider>
  );
}

/** Read the shared remove-mode state. Safe outside a provider (returns off). */
export function useRemoveMode(): RemoveModeValue {
  return useContext(RemoveModeContext) ?? { removeMode: false, setRemoveMode: () => {} };
}

/**
 * The "Remove" toggle shown below the search box for curators. Turning it on
 * reveals an X on every board card; turning it off hides them again.
 */
export function RemoveToggle() {
  const { removeMode, setRemoveMode } = useRemoveMode();
  return (
    <button
      type="button"
      onClick={() => setRemoveMode(!removeMode)}
      aria-pressed={removeMode}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[12.5px] font-medium transition-colors',
        removeMode
          ? 'bg-urgent-soft text-urgent border-urgent/30'
          : 'bg-panel text-ink-2 border-line hover:border-ink-4 hover:text-ink',
      )}
    >
      <i
        className={cn('text-[14px]', removeMode ? 'ti ti-check' : 'ti ti-trash')}
        aria-hidden="true"
      />
      {removeMode ? 'Done' : 'Remove'}
    </button>
  );
}
