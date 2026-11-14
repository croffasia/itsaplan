import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSyncSubscribe } from '@/context/syncContext';
import { listNotifications } from '@/lib/api/endpoints/notifications';
import { useProjectsQuery } from '@/services/projects.service';
import { qk } from '@/services/queryKeys';
import {
  notificationEventText,
  notificationPath,
  notificationSubject,
} from '@/utils/inboxNotification';
import { revScope } from '@/utils/revScopes';
import { NOTIFICATION_SETTINGS_EVENT, isPushOnInThisBrowser } from '@/utils/browserNotifications';

// Desktop notifications are turned on per browser: the choice is stored in this
// browser's localStorage, next to the permission the browser keeps for the site. They
// stand down while push is on in this browser, which shows the items instead.
const STORAGE_KEY = 'desktopNotifications';
// How many of the newest items, read or not, each inbox change reads. When more new
// items than this arrive between two reads, the older ones are never shown.
const LATEST = 20;
// A tab with the app shell in front marks itself here every FRONT_BEAT_MS, so that a
// hidden tab shows nothing while the member uses the app in another tab. Screens outside
// the shell (account and team settings) have no inbox and do not mark.
const FRONT_KEY = 'desktopNotificationsFront';
const FRONT_BEAT_MS = 10_000;
const TAB = Math.random().toString(36).slice(2);

type DesktopNotificationsState = 'unsupported' | 'blocked' | 'push' | 'off' | 'on';

function readState(): DesktopNotificationsState {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (isPushOnInThisBrowser()) return 'push';
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
  window.addEventListener(NOTIFICATION_SETTINGS_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(NOTIFICATION_SETTINGS_EVENT, onChange);
  };
}

// The server render has no browser, so it reports the notifications as off.
export function useDesktopNotificationsState(): DesktopNotificationsState {
  return useSyncExternalStore(subscribeState, readState, () => 'off');
}

export async function setDesktopNotifications(on: boolean) {
  if (on && Notification.permission === 'default') await Notification.requestPermission();
  try {
    if (on && Notification.permission === 'granted') localStorage.setItem(STORAGE_KEY, 'on');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode): the state stays as it was.
  }
  window.dispatchEvent(new Event(NOTIFICATION_SETTINGS_EVENT));
}

function inFront() {
  return document.visibilityState === 'visible' && document.hasFocus();
}

function clearFront() {
  try {
    if (localStorage.getItem(FRONT_KEY)?.startsWith(`${TAB} `)) localStorage.removeItem(FRONT_KEY);
  } catch {
    // Storage unavailable: other tabs cannot see this one.
  }
}

function markFront() {
  if (!inFront()) return clearFront();
  try {
    localStorage.setItem(FRONT_KEY, `${TAB} ${Date.now()}`);
  } catch {
    // Storage unavailable: other tabs cannot see this one.
  }
}

function anotherTabInFront() {
  try {
    const [tab, at] = (localStorage.getItem(FRONT_KEY) ?? '').split(' ');
    return tab !== TAB && Date.now() - Number(at) < FRONT_BEAT_MS * 3;
  } catch {
    return false;
  }
}

// Shows a desktop notification for each new inbox item, from every project, while the
// app is open but not in front: a browser tab in the background, or a desktop shell
// that forwards the Notifications API. While it is on, the sync poll keeps reading the
// inbox in a hidden tab. An item is shown only when it is unread and was created after the
// newest item read since the notifications came on, so older items, an item marked unread
// again and one back from a snooze are not. Nothing is shown while the app shell is in
// front, in this tab or in another. Clicking a notification opens its item.
export function useDesktopNotifications() {
  const on = useDesktopNotificationsState() === 'on';
  const subscribe = useSyncSubscribe();
  const router = useRouter();
  const te = useTranslations('inbox.event');
  const tDocuments = useTranslations('documents');
  const { data: projects } = useProjectsQuery();
  // The createdAt of the newest item read since the notifications came on ('' when the
  // member had none); null until the first read.
  const newest = useRef<string | null>(null);
  const onSince = useRef(0);

  useEffect(() => {
    if (!on) return;
    onSince.current = Date.now();
    markFront();
    const beat = setInterval(markFront, FRONT_BEAT_MS);
    window.addEventListener('focus', markFront);
    window.addEventListener('blur', markFront);
    window.addEventListener('pagehide', clearFront);
    document.addEventListener('visibilitychange', markFront);
    return () => {
      clearInterval(beat);
      window.removeEventListener('focus', markFront);
      window.removeEventListener('blur', markFront);
      window.removeEventListener('pagehide', clearFront);
      document.removeEventListener('visibilitychange', markFront);
      clearFront();
    };
  }, [on]);

  useEffect(() => {
    if (!on) return;
    return subscribe({
      scope: revScope.inboxAll,
      targets: [qk.notificationsLatest],
      background: true,
    });
  }, [on, subscribe]);

  const { data: latest, dataUpdatedAt } = useQuery({
    queryKey: qk.notificationsLatest,
    queryFn: () =>
      listNotifications(undefined, { limit: LATEST, filters: { includeSnoozed: true } }),
    enabled: on,
    select: (d) => d.items,
  });

  useEffect(() => {
    if (!on) {
      newest.current = null;
      return;
    }
    // Only a read made after the notifications came on sets the start, so items that
    // came in while they were off are not shown. The list is newest first.
    if (!latest || (newest.current == null && dataUpdatedAt < onSince.current)) return;
    const start = newest.current;
    const top = latest[0]?.createdAt ?? '';
    newest.current = start != null && start > top ? start : top;
    if (start == null) return;
    const fresh = latest.filter(
      (n) => n.createdAt > start && n.readAt == null && n.snoozedUntil == null,
    );
    // In front, here or in another tab, the inbox itself shows the new item.
    if (fresh.length === 0 || inFront() || anotherTabInFront()) return;
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
  }, [on, latest, dataUpdatedAt, projects, router, te, tDocuments]);
}
