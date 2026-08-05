import { useCallback, useState } from 'react';
import type { WorkItemsView } from '@/utils/viewTypes';
import { normalizeViewSettings, type ViewSettings } from '@/utils/viewSettings';
import { EMPTY_FILTER_SET, type FilterSet } from '@/utils/filters';

// Display settings for an issue board that has no saved views — the one an
// initiative or a cycle shows. Persisted in localStorage under `storeKey`, keyed by
// the id of the thing the board belongs to; filters stay transient in state. Layout
// (kanban/table) and its display settings are stored together so a reload restores
// them. Mirrors the localStorage store in lib/viewSettings.

type Stored = { layout?: WorkItemsView } & Partial<ViewSettings>;
type Store = Record<string, Stored>;

function readStore(storeKey: string): Store {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(storeKey) ?? 'null');
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(storeKey: string, store: Store) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storeKey, JSON.stringify(store));
}

export function useLocalBoardSettings(storeKey: string, id: number) {
  const key = String(id);
  const [state, setState] = useState<{ view: WorkItemsView; settings: ViewSettings }>(() => {
    const stored = readStore(storeKey)[key];
    const view: WorkItemsView = stored?.layout ?? 'kanban';
    return { view, settings: normalizeViewSettings(stored, view) };
  });
  const [filters, setFilters] = useState<FilterSet>(EMPTY_FILTER_SET);

  const persist = useCallback(
    (view: WorkItemsView, settings: ViewSettings) => {
      const store = readStore(storeKey);
      store[key] = { layout: view, ...settings };
      writeStore(storeKey, store);
    },
    [storeKey, key],
  );

  const changeView = useCallback(
    (view: WorkItemsView) => {
      const settings = normalizeViewSettings(readStore(storeKey)[key], view);
      persist(view, settings);
      setState({ view, settings });
    },
    [storeKey, key, persist],
  );

  const changeSettings = useCallback(
    (settings: ViewSettings) => {
      setState((prev) => {
        persist(prev.view, settings);
        return { ...prev, settings };
      });
    },
    [persist],
  );

  return {
    view: state.view,
    settings: state.settings,
    changeView,
    changeSettings,
    filters,
    setFilters,
  };
}
