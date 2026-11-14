import { Elysia, t } from 'elysia';
import { getWebPushConfig } from '@repo/db';
import { authContext } from '#shared/auth-context';
import { requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { noContent } from '#shared/http';
import { errors } from '#shared/responses';
import {
  PushConfigResponse,
  PushEndpointBody,
  PushSubscriptionBody,
  PushSubscriptionResponse,
} from './model';
import { deletePushSubscription, listPushSubscriptions, savePushSubscription } from './service';

// The session user's Web Push subscriptions, one per browser they turned push on in.
// Everything here is self-scoped: a user only ever reads or changes their own. Push is
// instance-wide and on only while the VAPID keys are set (see getWebPushConfig); which
// events it carries is chosen per project in notification-preferences.
export const pushRoutes = new Elysia({ name: 'push', detail: { tags: ['Push'] } })
  .use(authContext)

  .get(
    '/push/config',
    ({ user }) => {
      requireUser(user);
      const config = getWebPushConfig();
      return { enabled: config !== null, publicKey: config?.publicKey ?? null };
    },
    {
      response: { 200: PushConfigResponse, ...errors(401) },
      detail: {
        summary: 'Get the Web Push config',
        description:
          'Whether this instance sends push notifications, and the VAPID public key a browser subscribes with (null when it does not).',
      },
    },
  )

  .get('/push/subscriptions', ({ user }) => listPushSubscriptions(requireUser(user).id), {
    response: { 200: t.Array(PushSubscriptionResponse), ...errors(401) },
    detail: {
      summary: 'List push subscriptions',
      description: 'The browsers the session user turned push notifications on in, newest first.',
    },
  })

  .post(
    '/push/subscriptions',
    async ({ user, body, set }) => {
      const me = requireUser(user);
      const config = getWebPushConfig();
      if (!config) {
        throw new HttpError(400, 'Push notifications are not configured on this instance');
      }
      const saved = await savePushSubscription(me.id, body, config.publicKey);
      set.status = 201;
      return saved;
    },
    {
      body: PushSubscriptionBody,
      response: { 201: PushSubscriptionResponse, ...errors(400, 401, 409) },
      detail: {
        summary: 'Subscribe a browser to push notifications',
        description:
          "Stores the browser's push subscription, or updates the session user's own one with the same endpoint. A user keeps 10: an eleventh replaces the oldest.",
      },
    },
  )

  .delete(
    '/push/subscriptions',
    async ({ user, body }) => {
      await deletePushSubscription(requireUser(user).id, body.endpoint);
      return noContent();
    },
    {
      body: PushEndpointBody,
      response: { 204: t.Void(), ...errors(400, 401) },
      detail: {
        summary: 'Unsubscribe a browser from push notifications',
        description:
          "Removes the session user's subscription with this endpoint. An endpoint they hold no subscription for changes nothing.",
      },
    },
  );
