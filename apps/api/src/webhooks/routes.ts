import { Elysia, t } from 'elysia';
import { noContent } from '../shared/http';
import { guards, entityGuard } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { HttpError } from '../shared/lib';
import { mcpTool } from '../mcp/generate';
import { ErrorResponse } from '../shared/responses';
import {
  WEBHOOK_EVENT_TYPES,
  listWebhooks,
  createWebhook,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  listWebhookDeliveries,
} from './store';

const webhookParams = t.Object({ webhookId: t.Numeric() });

const eventType = t.UnionEnum([...WEBHOOK_EVENT_TYPES]);
const eventsSchema = t.Array(eventType, { minItems: 1 });

// A webhook subscription DTO (WebhookRow from the store).
const WebhookResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  url: t.String(),
  secret: t.String(),
  events: t.Array(eventType),
  isActive: t.Boolean(),
  createdAt: t.String(),
});

// A webhook delivery attempt DTO (WebhookDeliveryRow from the store).
const WebhookDeliveryResponse = t.Object({
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

// One page of deliveries (WebhookDeliveryPage from the store).
const WebhookDeliveryPageResponse = t.Object({
  items: t.Array(WebhookDeliveryResponse),
  nextCursor: t.Nullable(t.Number()),
});

// A local, loopback, or private-range host — the SSRF-sensitive targets.
function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '::1' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^f[cd][0-9a-f]{2}:/.test(host)
  );
}

// An IPv4 or IPv6 literal (as opposed to a DNS name).
function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
}

// Rejects urls that are not https or that point at a local/private address, so a
// subscription cannot be pointed at internal services (SSRF). The DNS-level check
// belongs to the delivery side; this is the syntactic guard at registration time.
//
// Exception for local development (NODE_ENV neither production nor test): a
// localhost / 0.0.0.0 / IP-literal target is allowed over http, so a local test
// receiver (e.g. http://localhost:3000/webhook-test/sink) can be registered.
// Production and the test suite stay strict.
function validateWebhookUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, 'Webhook url must be a valid URL');
  }
  const host = url.hostname.toLowerCase();

  const devRelaxed =
    process.env.NODE_ENV !== 'production' &&
    process.env.NODE_ENV !== 'test' &&
    (isLocalHost(host) || isIpLiteral(host));
  if (devRelaxed) return raw;

  if (url.protocol !== 'https:') {
    throw new HttpError(400, 'Webhook url must use https');
  }
  if (isLocalHost(host)) {
    throw new HttpError(400, 'Webhook url must not point to a private or local address');
  }
  return raw;
}

export const webhookRoutes = new Elysia({ name: 'webhooks', detail: { tags: ['Webhooks'] } })
  .use(authContext)
  .use(guards)
  // Guard for routes that address a webhook by its own id (no :projectKey in the
  // path). Set `webhook: "<action>"` in the route options.
  .macro({
    webhook: entityGuard(
      'webhooks',
      'Webhook not found',
      async (p) => (await getWebhook(Number(p.webhookId)))?.projectId ?? null,
    ),
  })
  .get(
    '/projects/:projectKey/webhooks',
    async ({ project }) => {
      return listWebhooks(project.id);
    },
    {
      permission: ['webhooks', 'read'],
      response: {
        200: t.Array(WebhookResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: "List a project's webhooks", ...mcpTool('list_webhooks') },
    },
  )

  .post(
    '/projects/:projectKey/webhooks',
    async ({ project, body, set }) => {
      set.status = 201;
      return createWebhook({
        projectId: project.id,
        url: validateWebhookUrl(body.url),
        events: body.events,
        isActive: body.isActive,
      });
    },
    {
      body: t.Object({
        url: t.String({ minLength: 1 }),
        events: eventsSchema,
        isActive: t.Optional(t.Boolean()),
      }),
      permission: ['webhooks', 'create'],
      response: {
        201: WebhookResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Create a webhook', ...mcpTool('create_webhook') },
    },
  )

  .patch(
    '/webhooks/:webhookId',
    async ({ params, body }) => {
      const patch = {
        ...body,
        ...(body.url !== undefined ? { url: validateWebhookUrl(body.url) } : {}),
      };
      const updated = await updateWebhook(params.webhookId, patch);
      if (!updated) throw new HttpError(404, 'Webhook not found');
      return updated;
    },
    {
      body: t.Object({
        url: t.Optional(t.String({ minLength: 1 })),
        events: t.Optional(eventsSchema),
        isActive: t.Optional(t.Boolean()),
      }),
      params: webhookParams,
      webhook: 'edit',
      response: {
        200: WebhookResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Update a webhook', ...mcpTool('update_webhook') },
    },
  )

  .delete(
    '/webhooks/:webhookId',
    async ({ params }) => {
      await deleteWebhook(params.webhookId);
      return noContent();
    },
    {
      params: webhookParams,
      webhook: 'delete',
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Delete a webhook', ...mcpTool('delete_webhook') },
    },
  )

  .get(
    '/webhooks/:webhookId/deliveries',
    async ({ params, query }) => {
      return listWebhookDeliveries(params.webhookId, { before: query.before, limit: query.limit });
    },
    {
      params: webhookParams,
      query: t.Object({
        before: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
      }),
      webhook: 'read',
      response: {
        200: WebhookDeliveryPageResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'List webhook deliveries',
        description: "List a webhook's delivery attempts.",
        ...mcpTool('list_webhook_deliveries'),
      },
    },
  );
