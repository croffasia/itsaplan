'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { focusManager, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { getRevs } from '@/lib/api/endpoints/sync';

// One poll for the whole app. Every screen that wants to stay live registers the
// scopes it depends on (see useLiveRefresh); this provider polls the API for their
// change markers and invalidates the queries of the scopes that moved. The heavy reads happen only on an actual change.
//
// While the tab is hidden (TanStack counts that as unfocused) the poll covers only the
// scopes of watchers that set `background`, and it stops when nothing is registered.
const POLL_MS = 8000;

const subscribeFocus = (onChange: () => void) => focusManager.subscribe(onChange);
const isFocused = () => focusManager.isFocused();

export interface ScopeWatcher {
  scope: string;
  targets: QueryKey[];
  background?: boolean;
}

const SyncCtx = createContext<((watcher: ScopeWatcher) => () => void) | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const watchers = useRef(new Set<ScopeWatcher>());
  const [scopes, setScopes] = useState<string[]>([]);
  const [backgroundScopes, setBackgroundScopes] = useState<string[]>([]);
  const focused = useSyncExternalStore(subscribeFocus, isFocused, () => true);
  const seen = useRef(new Map<string, string>());

  const subscribe = useCallback((watcher: ScopeWatcher) => {
    const sync = () => {
      const all = [...watchers.current];
      setScopes([...new Set(all.map((w) => w.scope))].sort());
      setBackgroundScopes([...new Set(all.filter((w) => w.background).map((w) => w.scope))].sort());
    };
    watchers.current.add(watcher);
    sync();
    return () => {
      watchers.current.delete(watcher);
      sync();
    };
  }, []);

  const polled = focused ? scopes : backgroundScopes;
  const { data } = useQuery({
    // The scope list is part of the key: a screen that mounts starts its own read
    // right away instead of waiting for the next tick.
    queryKey: ['sync', 'rev', polled],
    queryFn: () => getRevs(polled),
    enabled: polled.length > 0,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: backgroundScopes.length > 0,
    refetchOnWindowFocus: true,
    // Never served as fresh, but kept for one interval: with gcTime 0 a remount in
    // the same tick drops the in-flight read and fires a second one.
    staleTime: 0,
    gcTime: POLL_MS,
  });

  useEffect(() => {
    if (!data) return;
    for (const [scope, rev] of Object.entries(data.revs)) {
      const previous = seen.current.get(scope);
      seen.current.set(scope, rev);
      // The first value of a scope is the baseline: whatever the screen just
      // fetched matches it. Markers stay remembered after a screen unmounts, so
      // returning to it with a stale cache refetches on the first tick.
      if (previous === undefined || previous === rev) continue;
      for (const watcher of watchers.current) {
        if (watcher.scope !== scope) continue;
        for (const key of watcher.targets) void qc.invalidateQueries({ queryKey: key });
      }
    }
  }, [data, qc]);

  return <SyncCtx.Provider value={subscribe}>{children}</SyncCtx.Provider>;
}

export function useSyncSubscribe(): (watcher: ScopeWatcher) => () => void {
  const subscribe = useContext(SyncCtx);
  if (!subscribe) throw new Error('useSyncSubscribe must be used inside SyncProvider');
  return subscribe;
}
