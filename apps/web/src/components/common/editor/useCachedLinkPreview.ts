import { useCallback, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import type { ResolvedLinkPreview } from './resolveLinkPreview';

export function useCachedLinkPreview(url: string) {
  const client = useQueryClient();
  const { data: session, isPending } = useSession();
  const userId = session?.user.id;
  const subscribe = useCallback(
    (notify: () => void) => client.getQueryCache().subscribe(notify),
    [client],
  );
  const snapshot = useCallback(() => {
    if (!userId || isPending) return undefined;
    const target = new URL(url, window.location.origin);
    if (target.origin === window.location.origin) return undefined;
    const state = client.getQueryState<ResolvedLinkPreview>(['link-preview', userId, target.href]);
    if (!state || state.status !== 'success' || state.isInvalidated) return undefined;
    return state.data;
  }, [client, url, userId, isPending]);
  return useSyncExternalStore(subscribe, snapshot, () => undefined);
}
