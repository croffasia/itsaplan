import { useCallback, useEffect, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { isInitiativesTab, type InitiativesTab } from '@/utils/paths';
import { INITIATIVE_TABS } from '../utils/tabs';

// The order of the initiatives list tabs, persisted per browser and shared by
// every project: the strip is a display preference of the person, not of the
// project. Reordering is a drag on the strip (see InitiativesPage).

const STORE_KEY = 'planner_initiative_tab_order';

const DEFAULT_ORDER = INITIATIVE_TABS.map((t) => t.value);

// Keeps the stored order, dropping values that are no longer tabs and appending
// tabs the stored order does not mention, so a new tab shows up without a reset.
function normalize(stored: unknown): InitiativesTab[] {
  if (!Array.isArray(stored)) return DEFAULT_ORDER;
  const kept = stored.filter(
    (v, i): v is InitiativesTab =>
      typeof v === 'string' && isInitiativesTab(v) && stored.indexOf(v) === i,
  );
  return [...kept, ...DEFAULT_ORDER.filter((v) => !kept.includes(v))];
}

// Exported for callers that need the order without the strip: the list path reads
// it to pick which tab to open. Runs on the client only.
export function readInitiativeTabOrder(): InitiativesTab[] {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null'));
  } catch {
    return DEFAULT_ORDER;
  }
}

export function useInitiativeTabOrder() {
  // The stored order is read in an effect, not in the state initializer: the
  // initializer also runs during the server render, where there is no
  // localStorage, and a client-only initial order would not match the markup.
  const [order, setOrder] = useState<InitiativesTab[]>(DEFAULT_ORDER);

  useEffect(() => {
    setOrder(readInitiativeTabOrder());
  }, []);

  const reorder = useCallback((dragged: InitiativesTab, target: InitiativesTab) => {
    setOrder((prev) => {
      const from = prev.indexOf(dragged);
      const to = prev.indexOf(target);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = arrayMove(prev, from, to);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {
        // ignore write failures (private mode / quota); the state still updates.
      }
      return next;
    });
  }, []);

  return { order, reorder };
}
