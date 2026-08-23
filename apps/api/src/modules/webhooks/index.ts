import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards, entityGuard } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { mcpTool } from '#mcp/generate';
import { accessErrors, commonErrors } from '#shared/responses';
import {
  WebhookDeliveryPageResponse,
  WebhookResponse,
  createWebhookBody,
  listDeliveriesQuery,
  updateWebhookBody,
  webhookParams,
} from './model';
import {
  listWebhooks,
  createWebhook,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  listWebhookDeliveries,
} from './service';

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

// Rejects a url that is not https, or that targets a local or private address. This
// stops a subscription from reaching internal services (SSRF). The check is syntactic
// and runs at registration time. The delivery side runs the DNS-level check.
//
// Local development is the exception (NODE_ENV is neither production nor test): a
// localhost, 0.0.0.0, or IP-literal target passes over http, so an operator can
// register a local test receiver. Production and the test suite stay strict.
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
      response: { 200: t.Array(WebhookResponse), ...accessErrors },
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
      body: createWebhookBody,
      permission: ['webhooks', 'create'],
      response: { 201: WebhookResponse, ...commonErrors },
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
      body: updateWebhookBody,
      params: webhookParams,
      webhook: 'edit',
      response: { 200: WebhookResponse, ...commonErrors },
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
      response: { 204: t.Void(), ...commonErrors },
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
      query: listDeliveriesQuery,
      webhook: 'read',
      response: { 200: WebhookDeliveryPageResponse, ...commonErrors },
      detail: {
        summary: 'List webhook deliveries',
        description: "List a webhook's delivery attempts.",
        ...mcpTool('list_webhook_deliveries'),
      },
    },
  );
