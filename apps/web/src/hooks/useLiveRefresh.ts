import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

// Cheap live refresh. Polls a small "change marker" (rev) on an interval and, when
// the marker changes, invalidates the given heavy queries so they refetch once. The
// frequent request is tiny (a couple of columns); the full list/detail is fetched
// only on an actual change. Polling pauses while the tab is unfocused (TanStack's
// refetchIntervalInBackground defaults to false) and stops when this hook unmounts,
// so nothing runs for a screen that is closed.
export function useLiveRefresh(opts: {
  // Query key for the rev poll itself — distinct from the heavy query's key.
  revKey: QueryKey;
  // Fetches the current marker.
  fetchRev: () => Promise<{ rev: string }>;
  // Heavy query keys to invalidate when the marker changes.
  targets: QueryKey[];
  intervalMs: number;
  enabled?: boolean;
  // Returns the marker embedded in the cached heavy data, or null if none is
  // cached. When given, the first observed marker is compared against it: a
  // stale cache (cached marker != live marker) refetches immediately on mount
  // instead of waiting for the next change. Without it, the first marker is
  // skipped (the cache is assumed fresh on mount).
  getCachedRev?: () => string | null;
}) {
  const { revKey, fetchRev, targets, intervalMs, enabled = true, getCachedRev } = opts;
  const qc = useQueryClient();
  const lastRev = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: revKey,
    queryFn: fetchRev,
    enabled,
    refetchInterval: intervalMs,
    // The marker is a live signal, not cacheable data.
    staleTime: 0,
    gcTime: 0,
  });

  const rev = data?.rev ?? null;
  useEffect(() => {
    if (rev == null) return;
    // First observed value. Compare against the marker in the cached heavy data
    // when available: if the cache is stale (or absent), invalidate so mount
    // gets a fresh read; otherwise assume the cache is fresh and just record it.
    if (lastRev.current === null) {
      lastRev.current = rev;
      const cachedRev = getCachedRev?.();
      if (cachedRev != null && cachedRev !== rev) {
        for (const key of targets) void qc.invalidateQueries({ queryKey: key });
      }
      return;
    }
    if (rev !== lastRev.current) {
      lastRev.current = rev;
      for (const key of targets) void qc.invalidateQueries({ queryKey: key });
    }
    // targets/qc are stable enough; the marker value is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);
}
