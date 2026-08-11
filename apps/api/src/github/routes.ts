import { createHmac, timingSafeEqual } from 'node:crypto';
import { Elysia, t } from 'elysia';
import { guards } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { checkPermission } from '../shared/access';
import { HttpError } from '../shared/lib';
import { getProjectById } from '../projects/store';
import { handlePullRequestEvent, type PullRequestPayload } from './handler';
import {
  claimGithubDelivery,
  findProjectByGithubWebhookId,
  getOrCreateGithubSettings,
  recordGithubEvent,
  regenerateGithubSecret,
  updateGithubSettings,
} from './store';

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
    body: t.String(),
    params: t.Object({ webhookId: t.String() }),
    response: {
      200: t.Object({ ok: t.Boolean(), handled: t.String() }),
    },
    detail: {
      summary: 'Receive a GitHub webhook',
      description:
        'Receive a repository webhook delivery, verify its X-Hub-Signature-256, and apply ' +
        'the pull request automations to the issues its magic words name.',
    },
  },
);

// The GitHub settings DTO (GithubSettings from the store). Unlike outgoing
// webhook secrets, this secret authorizes issue moves through the receiver, so
// it is shown only to members with integrations edit access; read-only callers
// get null.
const GithubSettingsResponse = t.Object({
  enabled: t.Boolean(),
  webhookId: t.String(),
  secret: t.Nullable(t.String()),
  onMergeColumnId: t.Nullable(t.Number()),
  onOpenColumnId: t.Nullable(t.Number()),
  lastEventAt: t.Nullable(t.String()),
  lastEventRepo: t.Nullable(t.String()),
});

export const githubSettingsRoutes = new Elysia({
  name: 'github-settings',
  detail: { tags: ['GitHub'] },
})
  .use(authContext)
  .use(guards)
  .get(
    '/projects/:projectKey/settings/github',
    async ({ project, user }) => {
      const settings = await getOrCreateGithubSettings(project.id);
      const canEdit = await checkPermission(project.id, user, 'integrations', 'edit');
      return { ...settings, secret: canEdit ? settings.secret : null };
    },
    {
      permission: ['integrations', 'read'],
      response: { 200: GithubSettingsResponse },
      detail: { summary: "Get a project's GitHub integration settings" },
    },
  )
  .patch(
    '/projects/:projectKey/settings/github',
    ({ project, body }) => updateGithubSettings(project.id, body),
    {
      permission: ['integrations', 'edit'],
      body: t.Object({
        enabled: t.Optional(t.Boolean()),
        onMergeColumnId: t.Optional(t.Nullable(t.Number())),
        onOpenColumnId: t.Optional(t.Nullable(t.Number())),
      }),
      response: { 200: GithubSettingsResponse },
      detail: { summary: "Update a project's GitHub integration settings" },
    },
  )
  .post(
    '/projects/:projectKey/settings/github/secret',
    ({ project }) => regenerateGithubSecret(project.id),
    {
      permission: ['integrations', 'edit'],
      response: { 200: GithubSettingsResponse },
      detail: { summary: "Regenerate a project's GitHub webhook secret" },
    },
  );
