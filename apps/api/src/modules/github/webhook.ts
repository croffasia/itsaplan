import { createHmac, timingSafeEqual } from 'node:crypto';
import { Elysia } from 'elysia';
import { HttpError } from '#shared/lib';
import { errors } from '#shared/responses';
import { getProjectById } from '#modules/projects/service';
import { handlePullRequestEvent, type PullRequestPayload } from './handler';
import { WebhookAckResponse, webhookBody, webhookParams } from './model';
import { claimGithubDelivery, findProjectByGithubWebhookId, recordGithubEvent } from './service';

// GitHub's HMAC over the raw request body, sent as "sha256=<hex>".
function signatureValid(secret: string, rawBody: string, header: string | undefined): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const given = Buffer.from(header.slice('sha256='.length), 'hex');
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Inbound webhook receiver. Unauthenticated (GitHub carries no session) and
// mounted on the root app: the per-project secret verified against
// X-Hub-Signature-256 is the authentication. The body is parsed as text so the
// signature is computed over the exact bytes GitHub signed.
export const githubWebhookRoutes = new Elysia({
  name: 'github-webhook',
  detail: { tags: ['GitHub'] },
}).post(
  '/webhooks/github/:webhookId',
  async ({ params, body, headers }) => {
    const found = await findProjectByGithubWebhookId(params.webhookId);
    if (!found) throw new HttpError(404, 'Unknown webhook');
    if (!signatureValid(found.settings.secret, body, headers['x-hub-signature-256']))
      throw new HttpError(401, 'Invalid signature');

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new HttpError(400, 'Invalid JSON payload');
    }
    const repo = (payload as { repository?: { full_name?: string } }).repository?.full_name;
    if (repo) await recordGithubEvent(found.projectId, repo);

    const event = headers['x-github-event'];
    if (event !== 'pull_request') return { ok: true, handled: 'ignored' };
    if (!found.settings.enabled) return { ok: true, handled: 'disabled' };
    // GitHub sends a unique GUID per delivery and reuses it on redelivery; a
    // GUID seen before means a replay, which must not repeat its side effects.
    const deliveryId = headers['x-github-delivery'];
    if (deliveryId && !(await claimGithubDelivery(found.projectId, deliveryId)))
      return { ok: true, handled: 'duplicate' };
    const project = await getProjectById(found.projectId);
    if (!project) throw new HttpError(404, 'Unknown webhook');
    const handled = await handlePullRequestEvent(
      project,
      found.settings,
      payload as PullRequestPayload,
    );
    return { ok: true, handled };
  },
  {
    parse: 'text',
    body: webhookBody,
    params: webhookParams,
    response: { 200: WebhookAckResponse, ...errors(400, 401, 404) },
    detail: {
      summary: 'Receive a GitHub webhook',
      description:
        'Receive a repository webhook delivery, verify its X-Hub-Signature-256, and apply ' +
        'the pull request automations to the issues its magic words name.',
    },
  },
);
