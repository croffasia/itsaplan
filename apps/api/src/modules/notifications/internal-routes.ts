import { Elysia } from 'elysia';
import { getDeliveryConfig } from '#modules/notification-settings/service';
import { sendDeliveryBody } from './model';
import { sendDelivery } from './send';

// Internal endpoint the worker calls to deliver one claimed notification_delivery
// row. The project's channel credentials are encrypted at rest, so the send runs
// here (in the API, which owns the encryption key and the config store) rather than
// in the worker, mirroring /internal/agent-runs/execute. Authenticated with the
// shared WORKER_INTERNAL_TOKEN. Returns the SendResult so the worker records the
// outcome and decides whether to retry.
export const internalNotificationRoutes = new Elysia({
  name: 'internal-notification-deliveries',
  detail: { tags: ['Internal'] },
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
  {
    body: sendDeliveryBody,
    detail: {
      summary: 'Send one notification delivery',
      description:
        "Send a claimed delivery over its channel with the project's stored credentials and " +
        'return the result the worker records. Called by the worker with the x-worker-token ' +
        'header.',
    },
  },
);
