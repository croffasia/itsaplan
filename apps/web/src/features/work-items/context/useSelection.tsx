'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isTypingTarget } from '@/utils/hotkeys';
import { useHotkeyMatch } from '@/context/useHotkeys';

// Window event that selects every issue on the mounted board. The command palette
// lives in the shell, outside the provider, so it triggers select-all by dispatching
// this event; the provider listens for it only while a board is shown.
const BOARD_SELECT_ALL_EVENT = 'board:select-all';

// Multi-select state for the kanban board: the set of selected issue ids plus the
// operations the column headers, cards and bulk-action bar use to change it.
// Selection mode is simply "at least one issue selected" — there is no separate
// on/off flag.
interface SelectionApi {
  selected: Set<number>;
  isSelecting: boolean;
  isSelected: (id: number) => boolean;
  toggle: (id: number) => void;
  add: (ids: number[]) => void;
  remove: (ids: number[]) => void;
  selectAll: () => void;
  clear: () => void;
}

const SelectionContext = createContext<SelectionApi | null>(null);

// Holds the selection for one board instance. `validIds` are the ids currently on
// the board; ids that leave it (deleted, archived, filtered out) are pruned so the
// count and bulk actions never target issues no longer shown.
export function SelectionProvider({
  validIds,
  children,
}: {
  validIds: Set<number>;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const { matches } = useHotkeyMatch();

  // Latest board ids, read by the keyboard/event handlers without re-binding them.
  const validIdsRef = useRef(validIds);
  validIdsRef.current = validIds;

  useEffect(() => {
    setSelected((prev) => {
      let changed = false;
      const next = new Set<number>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [validIds]);

  const clear = useCallback(() => setSelected((prev) => (prev.size ? new Set() : prev)), []);
  const selectAll = useCallback(() => setSelected(new Set(validIdsRef.current)), []);

  // Escape clears; the select-all shortcut takes the whole board (unless a text
  // field is focused); the command palette's "Select all" dispatches
  // BOARD_SELECT_ALL_EVENT. The listeners live for the provider's lifetime, so the
  // shortcut is active only while a board is shown. The combination itself comes
  // from the shared hotkey map.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clear();
        return;
      }
      if (matches(e, 'board.select-all')) {
        if (isTypingTarget(document.activeElement)) return;
        e.preventDefault();
        selectAll();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(BOARD_SELECT_ALL_EVENT, selectAll);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(BOARD_SELECT_ALL_EVENT, selectAll);
    };
  }, [clear, selectAll, matches]);

  const api = useMemo<SelectionApi>(
    () => ({
      selected,
      isSelecting: selected.size > 0,
      isSelected: (id) => selected.has(id),
      toggle: (id) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      add: (ids) =>
        setSelected((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.add(id));
          return next;
        }),
      remove: (ids) =>
        setSelected((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        }),
      selectAll,
      clear,
    }),
    [selected, selectAll, clear],
  );

  return <SelectionContext.Provider value={api}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionApi {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within a SelectionProvider');
  return ctx;
}
