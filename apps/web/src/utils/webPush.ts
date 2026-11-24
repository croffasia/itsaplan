import { deletePushDevice, savePushDevice } from '@/lib/api/endpoints/push';
import { setPushOnInThisBrowser, thisBrowserSubscription } from './browserNotifications';

// Web Push in this browser: the service worker at /sw.js shows what the push service
// delivers, and the api keeps the subscription for the signed-in user.

export type PushBrowser =
  | { supported: false; ios: boolean }
  | { supported: true; permission: NotificationPermission; endpoint: string | null };

// iPadOS asks for the desktop site and calls itself a Mac; only its touch screen tells.
function isIos(): boolean {
  const agent = navigator.userAgent;
  return (
    /iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)
  );
}

function isSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function base64urlBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

// A subscription made with other keys than the instance's current ones gets nothing: its
// push service refuses this instance's token. When a browser does not report the key,
// the subscription counts as made with the current one.
function madeWith(subscription: PushSubscription, publicKey: string): boolean {
  const key = subscription.options.applicationServerKey;
  if (!key) return true;
  const used = new Uint8Array(key);
  const current = base64urlBytes(publicKey);
  return used.length === current.length && used.every((byte, i) => byte === current[i]);
}

// Safari on iOS and iPadOS has no PushManager outside the app added to the Home Screen.
export async function readPushBrowser(publicKey: string): Promise<PushBrowser> {
  if (!isSupported()) return { supported: false, ios: isIos() };
  const subscription = await thisBrowserSubscription();
  return {
    supported: true,
    permission: Notification.permission,
    endpoint: subscription && madeWith(subscription, publicKey) ? subscription.endpoint : null,
  };
}

// Asks for the permission before anything is awaited: Safari shows the prompt only from
// the tap itself. Anything but 'granted' leaves push off.
export async function subscribeThisBrowser(publicKey: string): Promise<NotificationPermission> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;
  await navigator.serviceWorker.register('/sw.js');
  const registration = await navigator.serviceWorker.ready;
  // One left by another account, one the api no longer keeps, or one made with old keys:
  // this account gets an endpoint of its own.
  await (await registration.pushManager.getSubscription())?.unsubscribe();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64urlBytes(publicKey),
  });
  const { endpoint, keys } = subscription.toJSON();
  await savePushDevice({ endpoint: endpoint!, keys: { p256dh: keys!.p256dh!, auth: keys!.auth! } });
  setPushOnInThisBrowser(true);
  return permission;
}

// The browser drops the subscription whatever the api answers, so nothing reaches it
// afterwards, signed out or not. A row the api keeps gets a 404 or 410 from the push
// service on its next send, and goes then. The desktop notifications come back at once.
export async function unsubscribeThisBrowser(): Promise<void> {
  setPushOnInThisBrowser(false);
  const subscription = await thisBrowserSubscription();
  if (!subscription) return;
  const [dropped, forgotten] = await Promise.allSettled([
    subscription.unsubscribe(),
    deletePushDevice(subscription.endpoint),
  ]);
  if (dropped.status === 'rejected') throw dropped.reason;
  if (forgotten.status === 'rejected') throw forgotten.reason;
}
