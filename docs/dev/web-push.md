# Web Push

Web Push is the third notification channel, next to email and Telegram. It uses the same
outbox, `notification_delivery`, and the same worker loop. It is on for the whole instance
while its keys are set, and each member chooses its events per project.

## One push, start to end

1. A member turns on **Push notifications on this device** in Account › Preferences ›
   Notifications. On that tap the browser asks for permission. The page then registers
   `apps/web/public/sw.js`, subscribes with the public key from `GET /push/config`, and sends
   the subscription to `POST /push/subscriptions`.
2. The api takes only an https endpoint whose host resolves to a public address, and never a
   host `SSRF_ALLOWED_HOSTS` trusts. It stores the browser in `push_subscription` with the VAPID
   public key it subscribed with, at most 10 per user, and drops the oldest one past that.
3. The member ticks the events in the Push column of a project's notification preferences
   (`user_notification_preference.push_events`).
4. An inbox notification runs `enqueueOutbound` in `apps/api/src/modules/notifications/outbound.ts`.
   For each browser of a member who wants the event, made with the current VAPID key, it queues
   one row: channel `push`, recipient the `push_subscription` id, payload
   `{ title, text, url, tag }`. The words are those of the Telegram message. The tag is
   `inbox-<notification id>`, so a second push for one item replaces the first.
5. `sendPush` in `apps/worker/src/notification-send.ts` reads the subscription, encrypts
   `{ title, body, url, tag }` to the browser's keys (RFC 8291, aes128gcm), signs a VAPID token
   (RFC 8292, ES256, valid for 12 hours) and POSTs through `pinnedFetch` with `TTL` one day
   and `Urgency: normal`. The whole request has 10 seconds: an endpoint that answers a byte at
   a time cannot hold the batch, and the notifications of every team behind it. The encryption
   and the token are in `apps/worker/src/web-push.ts`.
6. The push service answers. A 2xx is delivered. A 404 or 410 deletes the subscription and fails
   the delivery. A 429, a 5xx, a request that got no answer or one past the deadline is
   retried. Any other status fails the delivery.
7. The service worker shows the notification. A click focuses an open window of the app and
   navigates it to the url, or opens a new one.

Turning the switch off deletes the subscription on the server and unsubscribes the browser.
Signing out does the same, best effort. When the api ends the session (it expired or was
revoked), the browser drops its subscription on the way to the expired screen, without the
api, which no longer answers it. The push service then answers the next send with a 404 or 410,
and the worker deletes the row.

## Push and the desktop notifications

A browser does not merge a push with the in-page desktop notification of the same item, even
with the same tag: Chrome and Edge keep page and service-worker notifications apart. So the two
never run in one browser. Where push is on, `useDesktopNotifications` shows and reads nothing,
and the Desktop notifications row says push replaces it. The in-page path stays for browsers
without push and for instances with push off.

The switch keeps a flag for this in the browser's localStorage (`apps/web/src/utils/browserNotifications.ts`).
It is set after a subscribe and cleared on unsubscribe, on sign-out and when the session
ends. Each time the preferences page loads, `useAccountPushDevice` sets it from the real
subscription, so a subscription the browser revoked, one made with old keys, or push turned
off on the instance clears it. A change fires the desktop setting's change event in the tab,
and other tabs read it from their `storage` event.

## Keys

| Variable                     | Value                                                     |
| ---------------------------- | --------------------------------------------------------- |
| `WEB_PUSH_VAPID_PUBLIC_KEY`  | base64url of the uncompressed P-256 public key            |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | base64url of the 32-byte private key. A secret.           |
| `WEB_PUSH_SUBJECT`           | a `mailto:` or `https:` contact the push services can reach |

`bun run web-push:keys` prints a new pair. `getWebPushConfig` in
`packages/db/src/domains/web-push.ts` reads the three on every call, in the api and in the
worker, and returns null while any is unset. Then `GET /push/config` answers
`{ enabled: false }`, the web hides the switch and the Push column, the api refuses new
subscriptions, and `enqueueOutbound` queues no push.

A browser subscription is bound to the public key it was made with, and the api stores that key
with the row. A new pair ends every existing subscription: `enqueueOutbound` queues nothing for
a row made with another key, the worker fails a delivery queued for one before the change
without sending, and the switch shows push off in those browsers until members turn it on
again. The worker leaves such rows alone, since during a deploy it can still hold the old keys
while the api already stores rows made with the new ones.

## Trying it locally

1. Run `bun run web-push:keys`, put the two key lines in the root `.env`, add
   `WEB_PUSH_SUBJECT=mailto:you@example.com`, and restart `bun run dev`.
2. Open <http://localhost:3001> in Chrome or Firefox. `localhost` counts as a secure origin, so
   the service worker registers over http. Turn on push in Account › Preferences ›
   Notifications, then tick a Push box in a project's Notifications page.
3. From a second account, assign an issue to the first one. The worker sends on its next pass.
4. DevTools › Application › Service workers shows `sw.js`. Its **Push** button sends a plain
   text message, which the worker shows as the body.
5. A failed send stays in `notification_delivery` with `status = 'failed'` and the push
   service's answer in `last_error`.

Safari on iOS and iPadOS offers push only to the app added to the Home Screen, from 16.4. In a
Safari tab the switch says so.

## Tests

| What                                        | Where                                                             |
| ------------------------------------------- | ----------------------------------------------------------------- |
| encryption against the RFC 8291 example, the token | `apps/worker/src/__tests__/unit/web-push.test.ts`          |
| the push service's answers                  | `apps/worker/src/__tests__/integration/push-send.test.ts`         |
| the routes                                  | `apps/api/src/modules/push/__tests__/integration/push.test.ts`    |
| what is queued                              | `apps/api/src/modules/notifications/__tests__/integration/notifications.test.ts` |
| the switch, the flag                        | `apps/web/src/features/account/components/preferences/AccountPushNotifications.test.tsx` |
| desktop notifications standing down         | `apps/web/src/hooks/useDesktopNotifications.test.tsx`             |
| the Push column                             | `apps/web/src/features/settings/components/notifications/NotificationPreferences.test.tsx` |
| signing out                                 | `apps/web/src/lib/auth-client.test.ts`                            |
| the end of a session                        | `apps/web/src/lib/api/core/client.test.ts`                        |
| the service worker                          | `apps/web/src/utils/sw.test.ts`                                   |
