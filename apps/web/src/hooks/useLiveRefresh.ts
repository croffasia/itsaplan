import { useEffect, useRef } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { useSyncSubscribe, type ScopeWatcher } from '@/context/syncContext';

// Keeps a screen live: while it is mounted, the given queries are refetched
// whenever the scope's change marker moves. The polling itself belongs to
// SyncProvider — every screen shares one request — so a call site only names what
// it watches (see @/utils/revScopes) and what to refresh.
export function useLiveRefresh(opts: {
  scope: string | string[] | null;
  targets: QueryKey[];
  enabled?: boolean;
}) {
  const { scope, targets, enabled = true } = opts;
  const subscribe = useSyncSubscribe();
  let names: string[] = [];
  if (Array.isArray(scope)) names = scope;
  else if (scope) names = [scope];
  const scopes = JSON.stringify([...new Set(names)].sort());
  const watchers = useRef<ScopeWatcher[]>([]);
  const currentTargets = useRef(targets);

  // Updating targets does not restart the scope subscriptions.
  useEffect(() => {
    currentTargets.current = targets;
    for (const watcher of watchers.current) watcher.targets = targets;
  });

  useEffect(() => {
    if (!enabled) return;
    const names = JSON.parse(scopes) as string[];
    watchers.current = names.map((name) => ({ scope: name, targets: currentTargets.current }));
    const unsubscribe = watchers.current.map(subscribe);
    return () => {
      for (const stop of unsubscribe) stop();
      watchers.current = [];
    };
  }, [scopes, enabled, subscribe]);
}
