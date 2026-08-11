import { useEffect, useRef } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { useSyncSubscribe, type ScopeWatcher } from '@/context/syncContext';

// Keeps a screen live: while it is mounted, the given queries are refetched
// whenever the scope's change marker moves. The polling itself belongs to
// SyncProvider — every screen shares one request — so a call site only names what
// it watches (see @/utils/revScopes) and what to refresh.
export function useLiveRefresh(opts: {
  scope: string | null;
  targets: QueryKey[];
  enabled?: boolean;
}) {
  const { scope, targets, enabled = true } = opts;
  const subscribe = useSyncSubscribe();
  const watcher = useRef<ScopeWatcher>({ scope: scope ?? '', targets });

  // The targets are rebuilt on every render; the registered watcher is one object,
  // so it carries the latest ones.
  useEffect(() => {
    watcher.current.targets = targets;
  });

  useEffect(() => {
    if (!enabled || !scope) return;
    watcher.current.scope = scope;
    return subscribe(watcher.current);
  }, [scope, enabled, subscribe]);
}
