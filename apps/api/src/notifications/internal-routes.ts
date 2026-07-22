import { Elysia, t } from 'elysia';
import { getDeliveryConfig } from '../notification-settings/store';
import { sendDelivery } from './send';

// Internal endpoint the worker calls to deliver one claimed notification_delivery
// row. The project's channel credentials are encrypted at rest, so the send runs
// here (in the API, which owns the encryption key and the config store) rather than
// in the worker, mirroring /internal/agent-runs/execute. Authenticated with the
// shared WORKER_INTERNAL_TOKEN. Returns the SendResult so the worker records the
// outcome and decides whether to retry.
const sendBody = t.Object({
  projectId: t.Number(),
  channel: t.UnionEnum(['email', 'telegram']),
  recipient: t.Nullable(t.String()),
  payload: t.Object({
    subject: t.Optional(t.String()),
    text: t.String(),
    // The Telegram body. Elysia strips fields the schema does not declare, so
    // leaving it out here would silently drop the formatted message and send the
    // plain-text fallback instead.
    html: t.Optional(t.String()),
    url: t.Optional(t.String()),
  }),
});

export const internalNotificationRoutes = new Elysia({
  name: 'internal-notification-deliveries',
}).post(
  '/internal/notification-deliveries/send',
  async ({ body, headers, set }) => {
    const expected = process.env.WORKER_INTERNAL_TOKEN;
    if (!expected || headers['x-worker-token'] !== expected) {
      set.status = 401;
      return { ok: false, retryable: false, error: 'Unauthorized' };
    }
    const config = await getDeliveryConfig(body.projectId);
    return sendDelivery({
      channel: body.channel,
      recipient: body.recipient,
      payload: body.payload,
      config,
    });
  },
  { body: sendBody },
);
