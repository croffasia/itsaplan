import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSyncSubscribe } from '@/context/syncContext';
import { getUnreadCount } from '@/lib/api/endpoints/notifications';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';

// Shows the signed-in user's unread notifications, across every project, on the app
// icon through the Badging API: the Dock or taskbar badge of the installed web app, or
// of a desktop shell that forwards it. Refetched when any project's inbox scope moves.
// Where the browser has no Badging API it does nothing and fetches nothing.
export function useAppBadge(projectIds: number[]) {
  const supported = typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
  const subscribe = useSyncSubscribe();
  const ids = projectIds.join(',');

  useEffect(() => {
    if (!supported || !ids) return;
    const unsubscribe = ids
      .split(',')
      .map((id) =>
        subscribe({ scope: revScope.inbox(Number(id)), targets: [qk.notificationsUnreadTotal] }),
      );
    return () => unsubscribe.forEach((off) => off());
  }, [supported, ids, subscribe]);

  const { data: unread } = useQuery({
    queryKey: qk.notificationsUnreadTotal,
    queryFn: () => getUnreadCount(),
    enabled: supported,
    select: (d) => d.unread,
  });

  useEffect(() => {
    if (!supported || unread == null) return;
    const update = unread > 0 ? navigator.setAppBadge(unread) : navigator.clearAppBadge();
    // A browser may refuse the badge (no permission, not installed); the app works on.
    update.catch(() => {});
  }, [supported, unread]);
}
