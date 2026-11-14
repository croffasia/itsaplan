import { t } from 'elysia';

export const webhookParams = t.Object({ webhookId: t.Numeric() });

export const createWebhookBody = t.Object({
  url: t.String({ minLength: 1 }),
  events: t.Array(t.String({ minLength: 1, maxLength: 100 }), {
    minItems: 1,
    description: 'The events to send, from list_webhook_event_types.',
  }),
  isActive: t.Optional(t.Boolean()),
});

export const updateWebhookBody = t.Partial(createWebhookBody);

export const listDeliveriesQuery = t.Object({
  before: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export const WebhookResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  url: t.String(),
  secret: t.Nullable(
    t.String({
      description: 'Null in the list for a caller who may neither create nor edit webhooks.',
    }),
  ),
  events: t.Array(t.String()),
  isActive: t.Boolean(),
  createdAt: t.String(),
});

export const WebhookDeliveryResponse = t.Object({
  id: t.Number(),
  eventId: t.String(),
  eventType: t.String(),
  status: t.String(),
  attempts: t.Number(),
  payload: t.Any(),
  responseStatus: t.Nullable(t.Number()),
  responseBody: t.Nullable(t.String()),
  lastError: t.Nullable(t.String()),
  nextAttemptAt: t.String(),
  createdAt: t.String(),
});

export const WebhookDeliveryPageResponse = t.Object({
  items: t.Array(WebhookDeliveryResponse),
  nextCursor: t.Nullable(t.Number()),
});
