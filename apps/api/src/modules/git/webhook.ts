import { Elysia } from 'elysia';
import { HttpError } from '#shared/lib';
import { errors } from '#shared/responses';
import { getProjectById } from '#modules/projects/service';
import { handleGitEvent } from './handler';
import { detectProvider } from './providers';
import { WebhookAckResponse, webhookBody, webhookParams } from './model';
import { claimGitDelivery, findProjectByGitWebhookId, recordGitEvent } from './service';

// Inbound webhook receiver, shared by every supported repository host.
// Unauthenticated (a delivery carries no session) and mounted on the root app:
// the per-project secret, verified the way the sending provider supports, is the
// authentication. The body is parsed as text so a signature is computed over the
// exact bytes the provider signed.
async function receive({
  params,
  body,
  headers,
}: {
  params: { webhookId: string };
  body: string;
  headers: Record<string, string | undefined>;
}) {
  const found = await findProjectByGitWebhookId(params.webhookId);
  if (!found) throw new HttpError(404, 'Unknown webhook');
  const provider = detectProvider(headers);
  if (!provider) throw new HttpError(400, 'Unknown provider');
  if (!provider.verify(found.settings.secret, body, headers))
    throw new HttpError(401, 'Invalid signature');

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new HttpError(400, 'Invalid JSON payload');
  }
  const providerLabel = provider.label(headers);
  const providerKey = provider.key(headers);
  const repo = provider.repo(payload);
  if (repo) await recordGitEvent(found.projectId, repo, providerLabel);

  const event = provider.parse(payload, headers);
  if (!event) return { ok: true, handled: 'ignored' };
  if (!found.settings.enabled) return { ok: true, handled: 'disabled' };
  // A provider sends a unique id per delivery and reuses it on redelivery; an id
  // seen before means a replay, which must not repeat its side effects.
  const deliveryId = provider.deliveryId(headers);
  if (deliveryId && !(await claimGitDelivery(found.projectId, deliveryId)))
    return { ok: true, handled: 'duplicate' };
  const project = await getProjectById(found.projectId);
  if (!project) throw new HttpError(404, 'Unknown webhook');
  const handled = await handleGitEvent(project, found.settings, providerKey, providerLabel, event);
  return { ok: true, handled };
}

const options = {
  parse: 'text' as const,
  body: webhookBody,
  params: webhookParams,
  response: { 200: WebhookAckResponse, ...errors(400, 401, 404) },
  detail: {
    summary: 'Receive a repository webhook',
    description:
      'Receive branch, pull request, and CI webhooks from supported repository providers, verify ' +
      'them against the project secret, and update linked issues.',
  },
};

export const gitWebhookRoutes = new Elysia({
  name: 'git-webhook',
  detail: { tags: ['Git'] },
})
  .post('/webhooks/git/:webhookId', receive, options)
  // The path GitHub repositories were connected to before the receiver took
  // other providers. Kept so those webhooks keep working.
  .post('/webhooks/github/:webhookId', receive, options);
