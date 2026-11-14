// What this browser keeps for itself about notifications: whether push is on here, in its
// localStorage, and its push subscription. Push and the in-page desktop notifications do
// not run together: Chrome and Edge keep page and service-worker notifications apart, so
// one inbox item would show twice. While push is on in a browser, it shows the items
// there and the desktop notifications stand down. Nothing here calls the api, so the end
// of a session can use it too.
const PUSH_KEY = 'pushNotifications';

// Fired in this tab when either setting changes. Other tabs read the change from their
// 'storage' event.
export const NOTIFICATION_SETTINGS_EVENT = 'desktopnotificationschange';

// How long ending a session waits for this browser to drop its push subscription, so a
// browser that does not answer cannot hold the person on the page.
const PUSH_CLEANUP_WAIT_MS = 2000;

export function isPushOnInThisBrowser(): boolean {
  try {
    return localStorage.getItem(PUSH_KEY) === 'on';
  } catch {
    // Storage unavailable (private mode): push counts as off here.
    return false;
  }
}

export function setPushOnInThisBrowser(on: boolean) {
  if (isPushOnInThisBrowser() === on) return;
  try {
    if (on) localStorage.setItem(PUSH_KEY, 'on');
    else localStorage.removeItem(PUSH_KEY);
  } catch {
    // Storage unavailable (private mode): the desktop notifications keep their own setting.
  }
  window.dispatchEvent(new Event(NOTIFICATION_SETTINGS_EVENT));
}

// Null where the browser has no Push API (Safari on iOS outside the Home Screen app), or no
// subscription.
export async function thisBrowserSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

// For a session the api has ended: the browser drops its subscription without telling the
// api, which no longer answers it. The push service answers the next send with a 404 or
// 410, and the worker deletes the row then.
export async function endPushInThisBrowser(): Promise<void> {
  setPushOnInThisBrowser(false);
  await (await thisBrowserSubscription())?.unsubscribe();
}

// Best effort: a failure is ignored, and the wait is bounded.
export async function waitForPushCleanup(work: Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    work.catch(() => {}),
    new Promise((resolve) => (timer = setTimeout(resolve, PUSH_CLEANUP_WAIT_MS))),
  ]);
  clearTimeout(timer);
}
