// The service worker of push notifications. It has no fetch handler, so the app loads
// from the network as it does without one. The worker of the instance sends each push
// encrypted, as { title, body, url, tag }; a click on the notification opens its url.

self.addEventListener('install', () => self.skipWaiting());

// Takes the open windows at once: navigate() works only on a window this worker controls.
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    // The Push button in DevTools sends plain text.
    message = { body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(message.title || "It's a Plan", {
      body: message.body,
      tag: message.tag,
      data: { url: message.url },
      icon: '/icon-192.png',
    }),
  );
});

// A page of this app only. Anything else opens the app's start page.
function appUrl(url) {
  if (typeof url !== 'string') return '/';
  try {
    const parsed = new URL(url, self.location.origin);
    return parsed.origin === self.location.origin ? parsed.href : '/';
  } catch {
    return '/';
  }
}

// A click allows one focus() or openWindow() in Chrome, so the window is chosen first: one
// this worker controls, which navigate() accepts, or else a new one.
async function openNotification(url) {
  const windows = await self.clients.matchAll({ type: 'window' });
  const open = windows.find((client) => client.focused) ?? windows[0];
  if (!open) {
    await self.clients.openWindow(url);
    return;
  }
  await open.focus();
  await open.navigate(url);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openNotification(appUrl(event.notification.data?.url)));
});
