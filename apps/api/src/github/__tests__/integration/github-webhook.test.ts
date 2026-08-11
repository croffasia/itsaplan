import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'bun:test';
import { app } from '../../../app';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// The inbound GitHub webhook: a signed pull_request delivery moves the issues its
// magic words name, through the same path a user's move takes (activity entries,
// feed). Settings come from the planner routes; the delivery itself is
// unauthenticated and verified by signature alone.

interface Setup {
  asOwner: Api;
  webhookId: string;
  secret: string;
  columns: { id: number; stateType: string; name: string }[];
}

async function setupProject(): Promise<Setup> {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const settings = await asOwner.projects({ projectKey: 'MKT' }).settings.github.get();
  await asOwner.projects({ projectKey: 'MKT' }).settings.github.patch({ enabled: true });
  return {
    asOwner,
    webhookId: settings.data!.webhookId,
    secret: settings.data!.secret!,
    columns: view.data!.columns,
  };
}

function createIssue(client: Api, columnId: number, title = 'Task') {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title });
}

// A minimal pull_request payload with the fields the handler reads.
function prPayload(overrides: {
  action?: string;
  merged?: boolean;
  draft?: boolean;
  baseRef?: string;
  title?: string;
  body?: string;
}) {
  return {
    action: overrides.action ?? 'closed',
    pull_request: {
      number: 42,
      title: overrides.title ?? 'Some change',
      body: overrides.body ?? null,
      html_url: 'https://github.com/acme/site/pull/42',
      merged: overrides.merged ?? true,
      draft: overrides.draft ?? false,
      base: { ref: overrides.baseRef ?? 'main' },
    },
    repository: { full_name: 'acme/site', default_branch: 'main' },
  };
}

// Delivers a payload to the receiver, signed like GitHub signs it. Uses a raw
// Request so the signature is computed over the exact bytes sent.
async function deliver(
  webhookId: string,
  secret: string,
  payload: unknown,
  {
    event = 'pull_request',
    signature,
    deliveryId,
  }: { event?: string; signature?: string; deliveryId?: string } = {},
) {
  const body = JSON.stringify(payload);
  const sig = signature ?? `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  const res = await app.handle(
    new Request(`http://localhost/webhooks/github/${webhookId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': event,
        'x-hub-signature-256': sig,
        'x-github-delivery': deliveryId ?? crypto.randomUUID(),
      },
      body,
    }),
  );
  return { status: res.status, data: (await res.json().catch(() => null)) as unknown };
}

async function issueState(client: Api, issueId: number) {
  const res = await client.issues({ issueId }).get();
  return res.data!;
}

describe('GitHub webhook', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('closes the issue named by a closing magic word when the PR merges', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const done = columns.find((c) => c.stateType === 'completed')!;

    const res = await deliver(
      webhookId,
      secret,
      prPayload({ body: `Fixes MKT-${issue.sequenceNumber}` }),
    );
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ handled: 'merged' });

    const after = await issueState(asOwner, issue.id);
    expect(after.columnId).toBe(done.id);

    const feed = await asOwner.issues({ issueId: issue.id }).feed.get({ query: {} });
    const items = feed.data!.items;
    const prEntry = items.find((i: { action: string | null }) => i.action === 'github_pr');
    expect(prEntry).toMatchObject({
      actorName: 'GitHub',
      subject: 'merged',
      fromText: 'acme/site#42',
      toText: 'https://github.com/acme/site/pull/42',
    });
    const statusEntry = items.find((i: { action: string | null }) => i.action === 'status');
    expect(statusEntry).toMatchObject({ actorName: 'GitHub', toText: done.name });
  });

  it('moves the issue to the configured merge column', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const canceled = columns.find((c) => c.stateType === 'canceled')!;
    await asOwner
      .projects({ projectKey: 'MKT' })
      .settings.github.patch({ onMergeColumnId: canceled.id });
    const issue = (await createIssue(asOwner, columns[0].id)).data!;

    await deliver(webhookId, secret, prPayload({ title: `Closes MKT-${issue.sequenceNumber}` }));
    const after = await issueState(asOwner, issue.id);
    expect(after.columnId).toBe(canceled.id);
  });

  it('rejects a delivery with a bad signature', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;

    const res = await deliver(
      webhookId,
      secret,
      prPayload({ body: `Fixes MKT-${issue.sequenceNumber}` }),
      {
        signature: 'sha256=' + '0'.repeat(64),
      },
    );
    expect(res.status).toBe(401);
    expect((await issueState(asOwner, issue.id)).columnId).toBe(columns[0].id);
  });

  it('returns 404 for an unknown webhook id', async () => {
    await setupProject();
    const res = await deliver('0'.repeat(32), 'irrelevant', prPayload({}));
    expect(res.status).toBe(404);
  });

  it('ignores a merge into a non-default branch', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;

    const res = await deliver(
      webhookId,
      secret,
      prPayload({ body: `Fixes MKT-${issue.sequenceNumber}`, baseRef: 'develop' }),
    );
    expect(res.data).toMatchObject({ handled: 'ignored' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(columns[0].id);
  });

  it('ignores a closed-without-merge PR', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;

    const res = await deliver(
      webhookId,
      secret,
      prPayload({ body: `Fixes MKT-${issue.sequenceNumber}`, merged: false }),
    );
    expect(res.data).toMatchObject({ handled: 'ignored' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(columns[0].id);
  });

  it('leaves an issue named by skip alone', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;

    await deliver(
      webhookId,
      secret,
      prPayload({ body: `Fixes MKT-${issue.sequenceNumber}\nskip MKT-${issue.sequenceNumber}` }),
    );
    expect((await issueState(asOwner, issue.id)).columnId).toBe(columns[0].id);
  });

  it('leaves an already-closed issue in its column', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const canceled = columns.find((c) => c.stateType === 'canceled')!;
    const issue = (await createIssue(asOwner, canceled.id)).data!;

    await deliver(webhookId, secret, prPayload({ body: `Fixes MKT-${issue.sequenceNumber}` }));
    expect((await issueState(asOwner, issue.id)).columnId).toBe(canceled.id);
  });

  it('does nothing while the integration is disabled', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    await asOwner.projects({ projectKey: 'MKT' }).settings.github.patch({ enabled: false });
    const issue = (await createIssue(asOwner, columns[0].id)).data!;

    const res = await deliver(
      webhookId,
      secret,
      prPayload({ body: `Fixes MKT-${issue.sequenceNumber}` }),
    );
    expect(res.data).toMatchObject({ handled: 'disabled' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(columns[0].id);
  });

  it('moves a backlog issue to the configured column when a PR opens', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const started = columns.find((c) => c.stateType === 'started')!;
    await asOwner
      .projects({ projectKey: 'MKT' })
      .settings.github.patch({ onOpenColumnId: started.id });
    const issue = (await createIssue(asOwner, columns[0].id)).data!;

    const res = await deliver(
      webhookId,
      secret,
      prPayload({ action: 'opened', merged: false, body: `Refs MKT-${issue.sequenceNumber}` }),
    );
    expect(res.data).toMatchObject({ handled: 'opened' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(started.id);
  });

  it('links but does not move on PR open when no column is configured', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;

    await deliver(
      webhookId,
      secret,
      prPayload({ action: 'opened', merged: false, body: `Refs MKT-${issue.sequenceNumber}` }),
    );
    expect((await issueState(asOwner, issue.id)).columnId).toBe(columns[0].id);
    const feed = await asOwner.issues({ issueId: issue.id }).feed.get({ query: {} });
    const prEntry = feed.data!.items.find(
      (i: { action: string | null }) => i.action === 'github_pr',
    );
    expect(prEntry).toMatchObject({ actorName: 'GitHub', subject: 'opened' });
  });

  it('does not demote a started issue on PR open', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const started = columns.find((c) => c.stateType === 'started')!;
    const backlogish = columns.find(
      (c) => c.stateType === 'backlog' || c.stateType === 'unstarted',
    )!;
    await asOwner
      .projects({ projectKey: 'MKT' })
      .settings.github.patch({ onOpenColumnId: backlogish.id });
    const issue = (await createIssue(asOwner, started.id)).data!;

    await deliver(
      webhookId,
      secret,
      prPayload({ action: 'opened', merged: false, body: `Fixes MKT-${issue.sequenceNumber}` }),
    );
    expect((await issueState(asOwner, issue.id)).columnId).toBe(started.id);
  });

  it('hides the secret from a member who may read but not edit integrations', async () => {
    const { asOwner } = await setupProject();
    // A custom role with integrations read only, assigned to an invited member.
    const catalog = await asOwner.projects({ projectKey: 'MKT' }).roles.get();
    const emptyMatrix = Object.fromEntries(
      Object.keys(catalog.data![0].permissions).map((r) => [
        r,
        { create: false, edit: false, read: false, delete: false },
      ]),
    );
    const role = await asOwner.projects({ projectKey: 'MKT' }).roles.post({
      name: 'Integrations viewer',
      permissions: {
        ...emptyMatrix,
        integrations: { create: false, edit: false, read: true, delete: false },
      },
    });
    const viewer = await signUpTestUser({ name: 'Viewer' });
    const invite = await asOwner
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: viewer.email, role: 'member' });
    const asViewer = authedApi(viewer.cookie);
    await asViewer.invites({ token: invite.data!.token }).accept.post();
    await asOwner
      .projects({ projectKey: 'MKT' })
      .members({ userId: viewer.userId })
      .patch({ role: 'member', roleId: role.data!.id });

    const forViewer = await asViewer.projects({ projectKey: 'MKT' }).settings.github.get();
    expect(forViewer.status).toBe(200);
    expect(forViewer.data!.secret).toBeNull();

    const forOwner = await asOwner.projects({ projectKey: 'MKT' }).settings.github.get();
    expect(typeof forOwner.data!.secret).toBe('string');

    const patchAttempt = await asViewer
      .projects({ projectKey: 'MKT' })
      .settings.github.patch({ enabled: false });
    expect(patchAttempt.status).toBe(403);
  });

  it('a delivery stamps telemetry without touching the rest of the settings', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const canceled = columns.find((c) => c.stateType === 'canceled')!;
    await asOwner
      .projects({ projectKey: 'MKT' })
      .settings.github.patch({ onMergeColumnId: canceled.id });

    await deliver(webhookId, secret, prPayload({}));

    const after = await asOwner.projects({ projectKey: 'MKT' }).settings.github.get();
    expect(after.data).toMatchObject({
      enabled: true,
      secret,
      onMergeColumnId: canceled.id,
      lastEventRepo: 'acme/site',
    });
    expect(after.data!.lastEventAt).not.toBeNull();
  });

  it('processes a replayed delivery id only once', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const done = columns.find((c) => c.stateType === 'completed')!;
    const payload = prPayload({ body: `Fixes MKT-${issue.sequenceNumber}` });

    const first = await deliver(webhookId, secret, payload, { deliveryId: 'guid-1' });
    expect(first.data).toMatchObject({ handled: 'merged' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(done.id);

    // The user reopens the issue; replaying the same delivery must not re-close it.
    await asOwner.issues({ issueId: issue.id }).patch({ columnId: columns[0].id });
    const replay = await deliver(webhookId, secret, payload, { deliveryId: 'guid-1' });
    expect(replay.data).toMatchObject({ handled: 'duplicate' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(columns[0].id);
  });

  it('does not copy the GitHub settings into a project copy', async () => {
    const { asOwner } = await setupProject();
    const copy = await asOwner
      .projects({ projectKey: 'MKT' })
      .copy.post({ key: 'CPY', name: 'Copy', include: { configuration: true } });
    expect(copy.status).toBe(201);

    const source = await asOwner.projects({ projectKey: 'MKT' }).settings.github.get();
    const copied = await asOwner.projects({ projectKey: 'CPY' }).settings.github.get();
    expect(copied.data!.enabled).toBe(false);
    expect(copied.data!.webhookId).not.toBe(source.data!.webhookId);
    expect(copied.data!.secret).not.toBe(source.data!.secret);
  });

  it('regenerating the secret invalidates the old one', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const regenerated = await asOwner.projects({ projectKey: 'MKT' }).settings.github.secret.post();
    expect(regenerated.data!.secret).not.toBe(secret);

    const stale = await deliver(
      webhookId,
      secret,
      prPayload({ body: `Fixes MKT-${issue.sequenceNumber}` }),
    );
    expect(stale.status).toBe(401);

    const fresh = await deliver(
      webhookId,
      regenerated.data!.secret!,
      prPayload({ body: `Fixes MKT-${issue.sequenceNumber}` }),
    );
    expect(fresh.status).toBe(200);
  });
});
