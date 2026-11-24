import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSyncSubscribe } from '@/context/syncContext';
import { getUnreadCount } from '@/lib/api/endpoints/notifications';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';

// Shows the signed-in user's unread notifications, across every project, on the app
// icon through the Badging API: the Dock or taskbar badge of the installed web app, or
// of a desktop shell that forwards it. Refetched when the inbox of any project moves.
// Where the browser has no Badging API it does nothing and fetches nothing.
export function useAppBadge() {
  const supported = typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
  const subscribe = useSyncSubscribe();

  useEffect(() => {
    if (!supported) return;
    return subscribe({ scope: revScope.inboxAll, targets: [qk.notificationsUnreadTotal] });
  }, [supported, subscribe]);

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
