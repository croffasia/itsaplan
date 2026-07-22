import { useCallback, useState } from 'react';
import type { WorkItemsView } from '@/utils/viewTypes';
import { normalizeViewSettings, type ViewSettings } from '@/utils/viewSettings';
import { EMPTY_FILTER_SET, type FilterSet } from '@/utils/filters';

// Display settings for an initiative's issue board, persisted per initiative in
// localStorage (there are no saved views here). Filters stay transient in state.
// Layout (kanban/table) and its display settings are stored under one key so a
// reload restores them. Mirrors the localStorage store in lib/viewSettings but
// keyed by initiative id and layout.

const STORE_KEY = 'planner_initiative_board_settings';

type Stored = { layout?: WorkItemsView } & Partial<ViewSettings>;
type Store = Record<string, Stored>;

function readStore(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function useInitiativeBoardSettings(initiativeId: number) {
  const key = String(initiativeId);
  const [state, setState] = useState<{ view: WorkItemsView; settings: ViewSettings }>(() => {
    const stored = readStore()[key];
    const view: WorkItemsView = stored?.layout ?? 'kanban';
    return { view, settings: normalizeViewSettings(stored, view) };
  });
  const [filters, setFilters] = useState<FilterSet>(EMPTY_FILTER_SET);

  const persist = useCallback(
    (view: WorkItemsView, settings: ViewSettings) => {
      const store = readStore();
      store[key] = { layout: view, ...settings };
      writeStore(store);
    },
    [key],
  );

  const changeView = useCallback(
    (view: WorkItemsView) => {
      const settings = normalizeViewSettings(readStore()[key], view);
      persist(view, settings);
      setState({ view, settings });
    },
    [key, persist],
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
