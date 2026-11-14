import { t } from 'elysia';

export const PushConfigResponse = t.Object({
  enabled: t.Boolean(),
  publicKey: t.Nullable(t.String()),
});

// The browser's base64url keys, as PushSubscription.toJSON() gives them.
const Base64Url = t.String({ pattern: '^[A-Za-z0-9_-]+={0,2}$', maxLength: 128 });

const Endpoint = t.String({ minLength: 1, maxLength: 2048 });

export const PushSubscriptionBody = t.Object({
  endpoint: Endpoint,
  keys: t.Object({ p256dh: Base64Url, auth: Base64Url }),
});

export const PushEndpointBody = t.Object({ endpoint: Endpoint });

export const PushSubscriptionResponse = t.Object({
  id: t.Number(),
  endpoint: t.String(),
  createdAt: t.String(),
});
