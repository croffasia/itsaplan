import { useCallback, useEffect, useState } from 'react';
import type { WorkItemsView } from '@/utils/viewTypes';
import { normalizeViewSettings, type ViewSettings } from '@/utils/viewSettings';
import { EMPTY_FILTER_SET, toFilterSet, withExistingFields, type FilterSet } from '@/utils/filters';

// Display settings and filters for an issue board that has no saved views — the one
// an initiative or a cycle shows. Persisted in localStorage under `storeKey`, keyed by
// the id of the thing the board belongs to. The active layout, the display settings
// of each layout and the filters are stored, so a reload restores them and every
// layout keeps its own display. Mirrors the localStorage store in lib/viewSettings.

type Views = Partial<Record<WorkItemsView, Partial<ViewSettings>>>;
// An entry written before the layouts were kept apart holds one flat settings
// object instead of `views`, which belongs to the layout it was saved with.
type Stored = { layout?: WorkItemsView; views?: Views; filters?: unknown } & Partial<ViewSettings>;
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
  try {
    localStorage.setItem(storeKey, JSON.stringify(store));
  } catch {
    // Storage unavailable (private mode / quota): the board still changes.
  }
}

function viewsOf(stored: Stored | undefined): Views {
  if (!stored) return {};
  const { layout, views, filters: _filters, ...flat } = stored;
  return views ?? { [layout ?? 'kanban']: flat };
}

// `customFields` are the project's custom fields, or null until they are known.
export function useLocalBoardSettings(
  storeKey: string,
  id: number,
  customFields: readonly { id: number }[] | null = null,
) {
  const key = String(id);
  const [state, setState] = useState<{ view: WorkItemsView; settings: ViewSettings }>(() => {
    const stored = readStore(storeKey)[key];
    const view: WorkItemsView = stored?.layout ?? 'kanban';
    return { view, settings: normalizeViewSettings(viewsOf(stored)[view], view) };
  });
  const [filters, setFilters] = useState<FilterSet>(EMPTY_FILTER_SET);

  // Read in an effect rather than in the initializer, which also runs during the
  // server render, where a stored set would not match the markup.
  useEffect(() => {
    setFilters(toFilterSet(readStore(storeKey)[key]?.filters));
  }, [storeKey, key]);

  // A stored condition on a custom field deleted since is dropped once the fields are
  // known, whichever of the two arrives first. The updater runs after a set loaded in
  // the same commit; the stored entry loses it on the next change.
  useEffect(() => {
    if (customFields) setFilters((current) => withExistingFields(current, customFields));
  }, [customFields, filters]);

  const persist = useCallback(
    (view: WorkItemsView, settings: ViewSettings) => {
      const store = readStore(storeKey);
      const stored = store[key];
      store[key] = {
        layout: view,
        views: { ...viewsOf(stored), [view]: settings },
        filters: stored?.filters,
      };
      writeStore(storeKey, store);
    },
    [storeKey, key],
  );

  const changeView = useCallback(
    (view: WorkItemsView) => {
      const settings = normalizeViewSettings(viewsOf(readStore(storeKey)[key])[view], view);
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

  const changeFilters = useCallback(
    (next: FilterSet) => {
      setFilters(next);
      const store = readStore(storeKey);
      store[key] = { ...store[key], filters: next.conditions.length > 0 ? next : undefined };
      writeStore(storeKey, store);
    },
    [storeKey, key],
  );

  return {
    view: state.view,
    settings: state.settings,
    changeView,
    changeSettings,
    filters,
    changeFilters,
  };
}
