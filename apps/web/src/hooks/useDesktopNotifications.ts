import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSyncSubscribe } from '@/context/syncContext';
import { listUnreadNotifications } from '@/lib/api/endpoints/notifications';
import { useProjectsQuery } from '@/services/projects.service';
import { qk } from '@/services/queryKeys';
import {
  notificationEventText,
  notificationPath,
  notificationSubject,
} from '@/utils/inboxNotification';
import { revScope } from '@/utils/revScopes';

// Desktop notifications are turned on per browser: the choice is stored in this
// browser's localStorage, next to the permission the browser keeps for the site.
const STORAGE_KEY = 'desktopNotifications';
const CHANGE_EVENT = 'desktopnotificationschange';
// How many of the newest unread items each inbox change reads. When more items than
// this arrive between two reads, only the newest are shown.
const LATEST = 20;

type DesktopNotificationsState = 'unsupported' | 'blocked' | 'off' | 'on';

function readState(): DesktopNotificationsState {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  let stored = false;
  try {
    stored = localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    // Storage unavailable (private mode): notifications stay off.
  }
  return stored && Notification.permission === 'granted' ? 'on' : 'off';
}

function subscribeState(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// The server render has no browser, so it reports the notifications as off.
export function useDesktopNotificationsState(): DesktopNotificationsState {
  return useSyncExternalStore(subscribeState, readState, () => 'off');
}

// Turning on asks the browser for permission first and is stored only once it is
// granted.
export async function setDesktopNotifications(on: boolean) {
  if (on && Notification.permission === 'default') await Notification.requestPermission();
  try {
    if (on && Notification.permission === 'granted') localStorage.setItem(STORAGE_KEY, 'on');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode): the state stays as it was.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Shows a desktop notification for each new inbox item, from every project, while the
// app is open but not in front: a browser tab in the background, or a desktop shell
// that forwards the Notifications API. Items that were unread when the notifications
// came on are not shown again. Clicking a notification opens its item.
export function useDesktopNotifications() {
  const on = useDesktopNotificationsState() === 'on';
  const subscribe = useSyncSubscribe();
  const router = useRouter();
  const te = useTranslations('inbox.event');
  const tDocuments = useTranslations('documents');
  const { data: projects } = useProjectsQuery();
  // The items already seen; null until the first read after the notifications came on.
  const seen = useRef<Set<number> | null>(null);

  useEffect(() => {
    if (!on) return;
    return subscribe({ scope: revScope.inboxAll, targets: [qk.notificationsUnreadLatest] });
  }, [on, subscribe]);

  const { data: latest } = useQuery({
    queryKey: qk.notificationsUnreadLatest,
    queryFn: () => listUnreadNotifications(LATEST),
    enabled: on,
    select: (d) => d.items,
  });

  useEffect(() => {
    if (!on) {
      seen.current = null;
      return;
    }
    if (!latest) return;
    if (seen.current == null) {
      seen.current = new Set(latest.map((n) => n.id));
      return;
    }
    const known = seen.current;
    const fresh = latest.filter((n) => !known.has(n.id));
    for (const n of fresh) known.add(n.id);
    // In front, the inbox itself shows the new item.
    if (document.visibilityState === 'visible' && document.hasFocus()) return;
    for (const n of fresh) {
      const ref = projects?.find((p) => p.id === n.projectId)?.ref;
      const path = ref ? notificationPath(n, ref) : null;
      try {
        const shown = new Notification(notificationSubject(n, tDocuments('untitled')), {
          body: notificationEventText(n, te),
          tag: `inbox-${n.id}`,
          icon: '/icon-192.png',
        });
        shown.onclick = () => {
          window.focus();
          if (path) router.push(path);
          shown.close();
        };
      } catch {
        // A browser that shows notifications only from a service worker (Chrome on
        // Android) throws here; the inbox still has the item.
      }
    }
  }, [on, latest, projects, router, te, tDocuments]);
}
