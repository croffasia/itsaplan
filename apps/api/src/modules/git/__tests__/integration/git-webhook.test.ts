import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'bun:test';
import { app } from '../../../../app';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The inbound repository webhook: a verified pull request delivery moves the issues
// its magic words name, through the same path a user's move takes (activity entries,
// feed). Settings come from the planner routes; the delivery itself is
// unauthenticated and verified by its provider's credential alone.

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
  const settings = await asOwner.projects({ projectKey: 'MKT' }).settings.git.get();
  await asOwner.projects({ projectKey: 'MKT' }).settings.git.patch({ enabled: true });
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
  number?: number;
  merged?: boolean;
  draft?: boolean;
  baseRef?: string;
  title?: string;
  body?: string;
  headSha?: string;
  headRef?: string;
}) {
  const number = overrides.number ?? 42;
  return {
    action: overrides.action ?? 'closed',
    pull_request: {
      number,
      title: overrides.title ?? 'Some change',
      body: overrides.body ?? null,
      html_url: `https://github.com/acme/site/pull/${number}`,
      merged: overrides.merged ?? true,
      draft: overrides.draft ?? false,
      base: { ref: overrides.baseRef ?? 'main' },
      head: { ref: overrides.headRef ?? 'feature/site', sha: overrides.headSha ?? 'head-sha-1' },
    },
    repository: { full_name: 'acme/site', default_branch: 'main' },
  };
}

function checkPayload({
  id,
  name,
  conclusion,
  headSha = 'head-sha-1',
  pullRequestNumbers = [42],
}: {
  id: number;
  name: string;
  conclusion: string;
  headSha?: string;
  pullRequestNumbers?: number[];
}) {
  return {
    action: 'completed',
    check_run: {
      id,
      name,
      status: 'completed',
      conclusion,
      head_sha: headSha,
      details_url: `https://github.com/acme/site/actions/runs/${id}`,
      pull_requests: pullRequestNumbers.map((number) => ({ number })),
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
    new Request(`http://localhost/webhooks/git/${webhookId}`, {
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

// Delivers a raw body with the headers a given provider sends.
async function deliverRaw(webhookId: string, payload: unknown, headers: Record<string, string>) {
  const res = await app.handle(
    new Request(`http://localhost/webhooks/git/${webhookId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    }),
  );
  return { status: res.status, data: (await res.json().catch(() => null)) as unknown };
}

function gitlabPayload(
  body: string,
  action = 'merge',
  headSha = 'gitlab-head-1',
  sourceBranch = 'feature/site',
  mergeCommitSha?: string,
) {
  return {
    object_kind: 'merge_request',
    object_attributes: {
      iid: 7,
      title: 'Some change',
      description: body,
      url: 'https://gitlab.com/acme/site/-/merge_requests/7',
      action,
      source_branch: sourceBranch,
      target_branch: 'main',
      last_commit: { id: headSha },
      merge_commit_sha: mergeCommitSha,
    },
    project: {
      path_with_namespace: 'acme/site',
      default_branch: 'main',
      web_url: 'https://gitlab.com/acme/site',
    },
  };
}

function bitbucketPayload(body: string) {
  return {
    pullrequest: {
      id: 7,
      title: 'Some change',
      description: body,
      destination: { branch: { name: 'main' } },
      links: { html: { href: 'https://bitbucket.org/acme/site/pull-requests/7' } },
    },
    repository: { full_name: 'acme/site', mainbranch: { name: 'main' } },
  };
}

async function prActor(client: Api, issueId: number) {
  const feed = await client.issues({ issueId }).feed.get({ query: {} });
  return feed.data!.items.find((i: { action: string | null }) => i.action === 'git_pr');
}

async function issueState(client: Api, issueId: number) {
  const res = await client.issues({ issueId }).get();
  return res.data!;
}

describe('Repository webhook', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('exposes connected development repositories from an issue', async () => {
    const owner = await signUpTestUser({ name: 'Owner' });
    const asOwner = authedApi(owner.cookie);
    await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
    const project = await asOwner.projects({ projectKey: 'MKT' }).get();
    const issue = await createIssue(asOwner, project.data!.columns[0]!.id);

    const response = await app.handle(
      new Request(`http://localhost/issues/${issue.data!.id}/development/repositories`, {
        headers: { cookie: owner.cookie },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('rejects linking from a repository outside the issue project', async () => {
    const owner = await signUpTestUser({ name: 'Owner' });
    const asOwner = authedApi(owner.cookie);
    await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
    const project = await asOwner.projects({ projectKey: 'MKT' }).get();
    const issue = await createIssue(asOwner, project.data!.columns[0]!.id);

    const response = await app.handle(
      new Request(`http://localhost/issues/${issue.data!.id}/development`, {
        method: 'POST',
        headers: { cookie: owner.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ repositoryId: 999, number: 1 }),
      }),
    );

    expect(response.status).toBe(404);
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
    const prEntry = items.find((i: { action: string | null }) => i.action === 'git_pr');
    expect(prEntry).toMatchObject({
      actorName: 'GitHub',
      payload: {
        subject: { value: 'merged' },
        from: { value: 'acme/site#42', repo: 'acme/site', number: 42 },
        to: { value: 'https://github.com/acme/site/pull/42' },
      },
    });
    const statusEntry = items.find((i: { action: string | null }) => i.action === 'status');
    expect(statusEntry).toMatchObject({
      actorName: 'GitHub',
      payload: { to: { value: done.name, id: done.id } },
    });
  });

  it('moves the issue to the configured merge column', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const canceled = columns.find((c) => c.stateType === 'canceled')!;
    await asOwner
      .projects({ projectKey: 'MKT' })
      .settings.git.patch({ onMergeColumnId: canceled.id });
    const issue = (await createIssue(asOwner, columns[0].id)).data!;

    await deliver(webhookId, secret, prPayload({ title: `Closes MKT-${issue.sequenceNumber}` }));
    const after = await issueState(asOwner, issue.id);
    expect(after.columnId).toBe(canceled.id);
  });

  it('waits for every linked pull request before closing the issue', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const reference = `Fixes MKT-${issue.sequenceNumber}`;
    const done = columns.find((c) => c.stateType === 'completed')!;

    for (const number of [42, 43]) {
      await deliver(
        webhookId,
        secret,
        prPayload({ action: 'opened', merged: false, number, body: reference }),
      );
    }

    await deliver(webhookId, secret, prPayload({ number: 42, body: reference }));
    expect((await issueState(asOwner, issue.id)).columnId).toBe(columns[0].id);

    await deliver(webhookId, secret, prPayload({ number: 43, body: reference }));
    expect((await issueState(asOwner, issue.id)).columnId).toBe(done.id);
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
    await asOwner.projects({ projectKey: 'MKT' }).settings.git.patch({ enabled: false });
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
      .settings.git.patch({ onOpenColumnId: started.id });
    const issue = (await createIssue(asOwner, columns[0].id)).data!;

    const res = await deliver(
      webhookId,
      secret,
      prPayload({ action: 'opened', merged: false, body: `Refs MKT-${issue.sequenceNumber}` }),
    );
    expect(res.data).toMatchObject({ handled: 'opened' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(started.id);
  });

  it('ignores a draft PR and picks it up once it is marked ready', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const started = columns.find((c) => c.stateType === 'started')!;
    await asOwner
      .projects({ projectKey: 'MKT' })
      .settings.git.patch({ onOpenColumnId: started.id });
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const body = `Refs MKT-${issue.sequenceNumber}`;

    const draft = await deliver(
      webhookId,
      secret,
      prPayload({ action: 'opened', merged: false, draft: true, body }),
    );
    expect(draft.data).toMatchObject({ handled: 'ignored' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(columns[0].id);
    expect((await issueState(asOwner, issue.id)).development[0]).toMatchObject({
      state: 'open',
      draft: true,
    });

    const ready = await deliver(
      webhookId,
      secret,
      prPayload({ action: 'ready_for_review', merged: false, body }),
    );
    expect(ready.data).toMatchObject({ handled: 'opened' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(started.id);
    expect((await issueState(asOwner, issue.id)).development[0]).toMatchObject({
      state: 'open',
      draft: false,
    });
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
    const prEntry = feed.data!.items.find((i: { action: string | null }) => i.action === 'git_pr');
    expect(prEntry).toMatchObject({
      actorName: 'GitHub',
      payload: { subject: { value: 'opened' } },
    });
    expect((await issueState(asOwner, issue.id)).development).toMatchObject([
      {
        provider: 'github',
        repository: 'acme/site',
        number: 42,
        title: 'Some change',
        state: 'open',
        draft: false,
        sourceBranch: 'feature/site',
        targetBranch: 'main',
        headSha: 'head-sha-1',
        pipelineStatus: null,
        checkStatus: null,
        checks: [],
      },
    ]);
  });

  it('links an issue when a matching GitHub branch is created', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const branch = `feature/MKT-${issue.sequenceNumber}-summary`;

    const res = await deliver(
      webhookId,
      secret,
      {
        ref: branch,
        ref_type: 'branch',
        repository: {
          full_name: 'acme/site',
          default_branch: 'main',
          html_url: 'https://github.com/acme/site',
        },
      },
      { event: 'create' },
    );

    expect(res.data).toMatchObject({ handled: 'branch' });
    expect((await issueState(asOwner, issue.id)).development).toMatchObject([
      {
        kind: 'branch',
        number: null,
        repository: 'acme/site',
        sourceBranch: branch,
      },
    ]);
  });

  it('links from the PR branch name and replaces the branch-only link', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const branch = `MKT-${issue.sequenceNumber}-summary`;

    await deliver(
      webhookId,
      secret,
      {
        ref: branch,
        ref_type: 'branch',
        repository: { full_name: 'acme/site', default_branch: 'main' },
      },
      { event: 'create' },
    );
    await deliver(
      webhookId,
      secret,
      prPayload({ action: 'opened', merged: false, body: '', headRef: branch }),
    );

    expect((await issueState(asOwner, issue.id)).development).toMatchObject([
      { kind: 'pull_request', number: 42, sourceBranch: branch },
    ]);
  });

  it('keeps branch CI when the branch becomes a GitLab merge request', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const branch = `MKT-${issue.sequenceNumber}-pipeline`;
    const headSha = 'gitlab-branch-head';
    const headers = () => ({
      'x-gitlab-token': secret,
      'x-gitlab-event-uuid': crypto.randomUUID(),
    });

    await deliverRaw(
      webhookId,
      {
        object_kind: 'push',
        before: '0'.repeat(40),
        after: headSha,
        checkout_sha: headSha,
        ref: `refs/heads/${branch}`,
        project: {
          path_with_namespace: 'acme/site',
          default_branch: 'main',
          web_url: 'https://gitlab.com/acme/site',
        },
      },
      { 'x-gitlab-event': 'Push Hook', ...headers() },
    );
    await deliverRaw(
      webhookId,
      {
        object_kind: 'pipeline',
        object_attributes: { id: 88, status: 'success', sha: headSha, ref: branch },
        project: {
          path_with_namespace: 'acme/site',
          default_branch: 'main',
          web_url: 'https://gitlab.com/acme/site',
        },
      },
      { 'x-gitlab-event': 'Pipeline Hook', ...headers() },
    );
    expect((await issueState(asOwner, issue.id)).development[0]).toMatchObject({
      kind: 'branch',
      pipelineStatus: 'success',
    });

    await deliverRaw(webhookId, gitlabPayload('', 'open', headSha, branch), {
      'x-gitlab-event': 'Merge Request Hook',
      ...headers(),
    });
    expect((await issueState(asOwner, issue.id)).development).toMatchObject([
      {
        kind: 'pull_request',
        number: 7,
        sourceBranch: branch,
        pipelineStatus: 'success',
      },
    ]);
  });

  it('removes an existing pull request link when an edit adds skip', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const identifier = `MKT-${issue.sequenceNumber}`;

    await deliver(
      webhookId,
      secret,
      prPayload({ action: 'opened', merged: false, body: `Refs ${identifier}` }),
    );
    expect((await issueState(asOwner, issue.id)).development).toHaveLength(1);

    await deliver(
      webhookId,
      secret,
      prPayload({ action: 'edited', merged: false, body: `Skip ${identifier}` }),
    );
    expect((await issueState(asOwner, issue.id)).development).toEqual([]);
  });

  it('stores the backlink preference and defaults it on', async () => {
    const { asOwner } = await setupProject();
    const before = await asOwner.projects({ projectKey: 'MKT' }).settings.git.get();
    expect(before.data!.linkbackComments).toBe(true);

    const updated = await asOwner.projects({ projectKey: 'MKT' }).settings.git.patch({
      linkbackComments: false,
    });
    expect(updated.data!.linkbackComments).toBe(false);
  });

  it('lets an editor unlink a pull request from the issue', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    await deliver(
      webhookId,
      secret,
      prPayload({ action: 'opened', merged: false, body: `Refs MKT-${issue.sequenceNumber}` }),
    );
    const [link] = (await issueState(asOwner, issue.id)).development;
    expect(link).toBeDefined();

    const removed = await asOwner
      .issues({ issueId: issue.id })
      .development({ linkId: link!.id })
      .delete();
    expect(removed.status).toBe(204);
    expect((await issueState(asOwner, issue.id)).development).toEqual([]);
  });

  it('stores every GitHub check and aggregates the current result', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    await deliver(
      webhookId,
      secret,
      prPayload({ action: 'opened', merged: false, body: `Refs MKT-${issue.sequenceNumber}` }),
    );

    await deliver(
      webhookId,
      secret,
      checkPayload({ id: 1, name: 'Build', conclusion: 'success' }),
      {
        event: 'check_run',
      },
    );
    await deliver(
      webhookId,
      secret,
      checkPayload({ id: 2, name: 'Tests', conclusion: 'failure' }),
      {
        event: 'check_run',
      },
    );

    const development = (await issueState(asOwner, issue.id)).development[0];
    expect(development).toMatchObject({ checkStatus: 'failed' });
    expect(development.checks).toMatchObject([
      { name: 'Build', status: 'success' },
      { name: 'Tests', status: 'failed' },
    ]);

    await deliver(
      webhookId,
      secret,
      checkPayload({ id: 3, name: 'Tests', conclusion: 'success' }),
      { event: 'check_run' },
    );
    expect((await issueState(asOwner, issue.id)).development[0]).toMatchObject({
      checkStatus: 'success',
      checks: [
        { name: 'Build', status: 'success' },
        { name: 'Tests', status: 'success' },
      ],
    });
  });

  it('hides old checks after a push and matches fork checks by head SHA', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const body = `Refs MKT-${issue.sequenceNumber}`;
    await deliver(webhookId, secret, prPayload({ action: 'opened', merged: false, body }));
    await deliver(
      webhookId,
      secret,
      checkPayload({ id: 1, name: 'Build', conclusion: 'failure' }),
      {
        event: 'check_run',
      },
    );

    await deliver(
      webhookId,
      secret,
      prPayload({ action: 'synchronize', merged: false, body, headSha: 'head-sha-2' }),
    );
    expect((await issueState(asOwner, issue.id)).development[0]).toMatchObject({
      headSha: 'head-sha-2',
      checkStatus: null,
      checks: [],
    });

    await deliver(
      webhookId,
      secret,
      checkPayload({
        id: 2,
        name: 'Build',
        conclusion: 'success',
        headSha: 'head-sha-2',
        pullRequestNumbers: [],
      }),
      { event: 'check_run' },
    );
    expect((await issueState(asOwner, issue.id)).development[0]).toMatchObject({
      checkStatus: 'success',
      checks: [{ name: 'Build', status: 'success' }],
    });
  });

  it('ignores a late check from the previous head SHA', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const body = `Refs MKT-${issue.sequenceNumber}`;
    await deliver(webhookId, secret, prPayload({ action: 'opened', merged: false, body }));
    await deliver(
      webhookId,
      secret,
      prPayload({ action: 'synchronize', merged: false, body, headSha: 'head-sha-2' }),
    );
    await deliver(
      webhookId,
      secret,
      checkPayload({ id: 2, name: 'Build', conclusion: 'success', headSha: 'head-sha-2' }),
      { event: 'check_run' },
    );
    await deliver(
      webhookId,
      secret,
      checkPayload({ id: 1, name: 'Build', conclusion: 'failure', headSha: 'head-sha-1' }),
      { event: 'check_run' },
    );

    expect((await issueState(asOwner, issue.id)).development[0]).toMatchObject({
      headSha: 'head-sha-2',
      checkStatus: 'success',
      checks: [{ name: 'Build', status: 'success' }],
    });
  });

  it('does not demote a started issue on PR open', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const started = columns.find((c) => c.stateType === 'started')!;
    const backlogish = columns.find(
      (c) => c.stateType === 'backlog' || c.stateType === 'unstarted',
    )!;
    await asOwner
      .projects({ projectKey: 'MKT' })
      .settings.git.patch({ onOpenColumnId: backlogish.id });
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

    const forViewer = await asViewer.projects({ projectKey: 'MKT' }).settings.git.get();
    expect(forViewer.status).toBe(200);
    expect(forViewer.data!.secret).toBeNull();

    const connections = await asViewer
      .projects({ projectKey: 'MKT' })
      .settings.git.connections.get();
    expect(connections.status).toBe(200);
    expect(connections.data).toEqual([]);

    const repositoryDiscovery = await asViewer
      .projects({ projectKey: 'MKT' })
      .settings.git.connections({ connectionId: 1 })
      .repositories.get({ query: {} });
    expect(repositoryDiscovery.status).toBe(403);

    const forOwner = await asOwner.projects({ projectKey: 'MKT' }).settings.git.get();
    expect(typeof forOwner.data!.secret).toBe('string');

    const patchAttempt = await asViewer
      .projects({ projectKey: 'MKT' })
      .settings.git.patch({ enabled: false });
    expect(patchAttempt.status).toBe(403);
  });

  it('a delivery records its repository without touching the rest of the settings', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const canceled = columns.find((c) => c.stateType === 'canceled')!;
    await asOwner
      .projects({ projectKey: 'MKT' })
      .settings.git.patch({ onMergeColumnId: canceled.id });

    await deliver(webhookId, secret, prPayload({}));

    const after = await asOwner.projects({ projectKey: 'MKT' }).settings.git.get();
    expect(after.data).toMatchObject({ enabled: true, secret, onMergeColumnId: canceled.id });
    expect(after.data!.repositories).toMatchObject([{ repo: 'acme/site', provider: 'GitHub' }]);
    expect(after.data!.repositories[0].lastEventAt).not.toBeNull();
  });

  it('lists every repository that delivered, newest first and without duplicates', async () => {
    const { asOwner, webhookId, secret } = await setupProject();
    await deliver(webhookId, secret, prPayload({}));

    const other = prPayload({});
    other.repository.full_name = 'acme/docs';
    await deliver(webhookId, secret, other);
    await deliver(webhookId, secret, prPayload({}));

    const after = await asOwner.projects({ projectKey: 'MKT' }).settings.git.get();
    expect(after.data!.repositories.map((r) => r.repo)).toEqual(['acme/site', 'acme/docs']);
  });

  it('lists a GitLab repository under its own provider', async () => {
    const { asOwner, webhookId, secret } = await setupProject();
    await deliverRaw(webhookId, gitlabPayload('nothing to close'), {
      'x-gitlab-event': 'Merge Request Hook',
      'x-gitlab-token': secret,
      'x-gitlab-event-uuid': crypto.randomUUID(),
    });

    const after = await asOwner.projects({ projectKey: 'MKT' }).settings.git.get();
    expect(after.data!.repositories).toMatchObject([{ repo: 'acme/site', provider: 'GitLab' }]);
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

  it('does not copy the repository settings into a project copy', async () => {
    const { asOwner } = await setupProject();
    const copy = await asOwner
      .projects({ projectKey: 'MKT' })
      .copy.post({ key: 'CPY', name: 'Copy', include: { configuration: true } });
    expect(copy.status).toBe(201);

    const source = await asOwner.projects({ projectKey: 'MKT' }).settings.git.get();
    const copied = await asOwner.projects({ projectKey: 'CPY' }).settings.git.get();
    expect(copied.data!.enabled).toBe(false);
    expect(copied.data!.webhookId).not.toBe(source.data!.webhookId);
    expect(copied.data!.secret).not.toBe(source.data!.secret);
  });

  it('regenerating the secret invalidates the old one', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const regenerated = await asOwner.projects({ projectKey: 'MKT' }).settings.git.secret.post();
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
  it('closes an issue on a merged GitLab merge request', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const done = columns.find((c) => c.stateType === 'completed')!;

    const res = await deliverRaw(webhookId, gitlabPayload(`Fixes MKT-${issue.sequenceNumber}`), {
      'x-gitlab-event': 'Merge Request Hook',
      'x-gitlab-token': secret,
      'x-gitlab-event-uuid': crypto.randomUUID(),
    });
    expect(res.data).toMatchObject({ handled: 'merged' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(done.id);
    expect(await prActor(asOwner, issue.id)).toMatchObject({
      actorName: 'GitLab',
      payload: { subject: { value: 'merged' }, from: { value: 'acme/site#7' } },
    });
  });

  it('updates a linked GitLab merge request from a pipeline event', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    await deliverRaw(webhookId, gitlabPayload(`Refs MKT-${issue.sequenceNumber}`, 'open'), {
      'x-gitlab-event': 'Merge Request Hook',
      'x-gitlab-token': secret,
      'idempotency-key': crypto.randomUUID(),
    });

    const pipeline = await deliverRaw(
      webhookId,
      {
        object_kind: 'pipeline',
        object_attributes: { id: 99, status: 'failed', ref: 'feature/site' },
        merge_request: { iid: 7, source_branch: 'feature/site' },
        project: {
          path_with_namespace: 'acme/site',
          default_branch: 'main',
          web_url: 'https://gitlab.com/acme/site',
        },
      },
      {
        'x-gitlab-event': 'Pipeline Hook',
        'x-gitlab-token': secret,
        'idempotency-key': crypto.randomUUID(),
      },
    );
    expect(pipeline.data).toMatchObject({ handled: 'pipeline' });
    expect((await issueState(asOwner, issue.id)).development[0]).toMatchObject({
      provider: 'gitlab',
      number: 7,
      pipelineStatus: 'failed',
      pipelineUrl: 'https://gitlab.com/acme/site/-/pipelines/99',
    });
  });

  it('attaches a post-merge GitLab release pipeline to its work item', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const sourceBranch = 'release/production';
    const headers = () => ({
      'x-gitlab-token': secret,
      'idempotency-key': crypto.randomUUID(),
    });

    await deliverRaw(
      webhookId,
      gitlabPayload(`Refs MKT-${issue.sequenceNumber}`, 'open', 'gitlab-source-head', sourceBranch),
      { 'x-gitlab-event': 'Merge Request Hook', ...headers() },
    );
    await deliverRaw(
      webhookId,
      {
        object_kind: 'pipeline',
        object_attributes: {
          id: 99,
          status: 'success',
          ref: sourceBranch,
          sha: 'gitlab-source-head',
        },
        merge_request: { iid: 7, source_branch: sourceBranch },
        project: {
          path_with_namespace: 'acme/site',
          default_branch: 'main',
          web_url: 'https://gitlab.com/acme/site',
        },
      },
      { 'x-gitlab-event': 'Pipeline Hook', ...headers() },
    );

    await deliverRaw(
      webhookId,
      gitlabPayload(
        `Fixes MKT-${issue.sequenceNumber}`,
        'merge',
        'gitlab-source-head',
        sourceBranch,
        'gitlab-merge-head',
      ),
      { 'x-gitlab-event': 'Merge Request Hook', ...headers() },
    );
    expect((await issueState(asOwner, issue.id)).development[0]).toMatchObject({
      state: 'merged',
      headSha: 'gitlab-merge-head',
      pipelineStatus: 'success',
    });

    const pipeline = await deliverRaw(
      webhookId,
      {
        object_kind: 'pipeline',
        object_attributes: {
          id: 100,
          status: 'running',
          ref: 'v1.2.3',
          sha: 'gitlab-merge-head',
        },
        project: {
          path_with_namespace: 'acme/site',
          default_branch: 'main',
          web_url: 'https://gitlab.com/acme/site',
        },
      },
      { 'x-gitlab-event': 'Pipeline Hook', ...headers() },
    );

    expect(pipeline.data).toMatchObject({ handled: 'pipeline' });
    expect((await issueState(asOwner, issue.id)).development[0]).toMatchObject({
      provider: 'gitlab',
      number: 7,
      state: 'merged',
      sourceBranch,
      headSha: 'gitlab-merge-head',
      pipelineStatus: 'running',
      pipelineUrl: 'https://gitlab.com/acme/site/-/pipelines/100',
    });
  });

  it('ignores a late GitLab pipeline from the previous head SHA', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const body = `Refs MKT-${issue.sequenceNumber}`;
    await deliverRaw(webhookId, gitlabPayload(body, 'open'), {
      'x-gitlab-event': 'Merge Request Hook',
      'x-gitlab-token': secret,
      'idempotency-key': crypto.randomUUID(),
    });
    await deliverRaw(webhookId, gitlabPayload(body, 'update', 'gitlab-head-2'), {
      'x-gitlab-event': 'Merge Request Hook',
      'x-gitlab-token': secret,
      'idempotency-key': crypto.randomUUID(),
    });

    const pipelinePayload = (sha: string, status: string) => ({
      object_kind: 'pipeline',
      object_attributes: { id: 99, status, ref: 'feature/site', sha },
      merge_request: { iid: 7, source_branch: 'feature/site' },
      project: { path_with_namespace: 'acme/site', web_url: 'https://gitlab.com/acme/site' },
    });
    await deliverRaw(webhookId, pipelinePayload('gitlab-head-1', 'failed'), {
      'x-gitlab-event': 'Pipeline Hook',
      'x-gitlab-token': secret,
      'idempotency-key': crypto.randomUUID(),
    });
    expect((await issueState(asOwner, issue.id)).development[0]).toMatchObject({
      headSha: 'gitlab-head-2',
      pipelineStatus: null,
    });

    await deliverRaw(webhookId, pipelinePayload('gitlab-head-2', 'success'), {
      'x-gitlab-event': 'Pipeline Hook',
      'x-gitlab-token': secret,
      'idempotency-key': crypto.randomUUID(),
    });
    expect((await issueState(asOwner, issue.id)).development[0]).toMatchObject({
      headSha: 'gitlab-head-2',
      pipelineStatus: 'success',
    });
  });

  it('deduplicates a retried GitLab delivery by its idempotency key', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const done = columns.find((c) => c.stateType === 'completed')!;
    const payload = gitlabPayload(`Fixes MKT-${issue.sequenceNumber}`);
    // GitLab keeps Idempotency-Key stable across retries but gives the retry a
    // fresh event uuid, so the key is what identifies the delivery.
    const headers = (eventUuid: string) => ({
      'x-gitlab-event': 'Merge Request Hook',
      'x-gitlab-token': secret,
      'x-gitlab-event-uuid': eventUuid,
      'idempotency-key': 'key-1',
    });

    const first = await deliverRaw(webhookId, payload, headers(crypto.randomUUID()));
    expect(first.data).toMatchObject({ handled: 'merged' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(done.id);

    await asOwner.issues({ issueId: issue.id }).patch({ columnId: columns[0].id });
    const retry = await deliverRaw(webhookId, payload, headers(crypto.randomUUID()));
    expect(retry.data).toMatchObject({ handled: 'duplicate' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(columns[0].id);
  });

  it('picks up a GitLab merge request when its draft flag is cleared', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const started = columns.find((c) => c.stateType === 'started')!;
    await asOwner
      .projects({ projectKey: 'MKT' })
      .settings.git.patch({ onOpenColumnId: started.id });
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const headers = {
      'x-gitlab-event': 'Merge Request Hook',
      'x-gitlab-token': secret,
      'idempotency-key': crypto.randomUUID(),
    };

    // Every other edit arrives as "update" too, so only the changes diff counts.
    const renamed = await deliverRaw(
      webhookId,
      {
        ...gitlabPayload(`Refs MKT-${issue.sequenceNumber}`, 'update'),
        changes: { title: { previous: 'Old', current: 'Some change' } },
      },
      headers,
    );
    expect(renamed.data).toMatchObject({ handled: 'ignored' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(columns[0].id);

    const ready = await deliverRaw(
      webhookId,
      {
        ...gitlabPayload(`Refs MKT-${issue.sequenceNumber}`, 'update'),
        changes: { draft: { previous: true, current: false } },
      },
      { ...headers, 'idempotency-key': crypto.randomUUID() },
    );
    expect(ready.data).toMatchObject({ handled: 'opened' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(started.id);
  });

  it('rejects a GitLab delivery carrying the wrong token', async () => {
    const { asOwner, webhookId, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;

    const res = await deliverRaw(webhookId, gitlabPayload(`Fixes MKT-${issue.sequenceNumber}`), {
      'x-gitlab-event': 'Merge Request Hook',
      'x-gitlab-token': 'not-the-secret',
    });
    expect(res.status).toBe(401);
    expect((await issueState(asOwner, issue.id)).columnId).toBe(columns[0].id);
  });

  it('closes an issue on a merged Gitea pull request', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const done = columns.find((c) => c.stateType === 'completed')!;
    const payload = prPayload({ body: `Fixes MKT-${issue.sequenceNumber}` });

    // Gitea signs the body like GitHub does, but sends the digest bare.
    const res = await deliverRaw(webhookId, payload, {
      'x-gitea-event': 'pull_request',
      'x-gitea-signature': createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex'),
      'x-gitea-delivery': crypto.randomUUID(),
    });
    expect(res.data).toMatchObject({ handled: 'merged' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(done.id);
    expect(await prActor(asOwner, issue.id)).toMatchObject({ actorName: 'Gitea' });
  });

  it('closes an issue on a merged Bitbucket pull request', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const done = columns.find((c) => c.stateType === 'completed')!;
    const payload = bitbucketPayload(`Fixes MKT-${issue.sequenceNumber}`);

    const res = await deliverRaw(webhookId, payload, {
      'x-event-key': 'pullrequest:fulfilled',
      'x-hub-signature': `sha256=${createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')}`,
      'x-request-uuid': crypto.randomUUID(),
    });
    expect(res.data).toMatchObject({ handled: 'merged' });
    expect((await issueState(asOwner, issue.id)).columnId).toBe(done.id);
    expect(await prActor(asOwner, issue.id)).toMatchObject({ actorName: 'Bitbucket' });
  });

  it('rejects a Bitbucket delivery with no signature', async () => {
    const { asOwner, webhookId, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;

    const res = await deliverRaw(webhookId, bitbucketPayload(`Fixes MKT-${issue.sequenceNumber}`), {
      'x-event-key': 'pullrequest:fulfilled',
    });
    expect(res.status).toBe(401);
    expect((await issueState(asOwner, issue.id)).columnId).toBe(columns[0].id);
  });

  it('names Forgejo as the actor on a Forgejo delivery', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const payload = prPayload({ body: `Fixes MKT-${issue.sequenceNumber}` });

    // Forgejo signs with its own header and sends Gitea's event header too.
    const res = await deliverRaw(webhookId, payload, {
      'x-forgejo-event': 'pull_request',
      'x-gitea-event': 'pull_request',
      'x-forgejo-signature': createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex'),
      'x-forgejo-delivery': crypto.randomUUID(),
    });
    expect(res.data).toMatchObject({ handled: 'merged' });
    expect(await prActor(asOwner, issue.id)).toMatchObject({ actorName: 'Forgejo' });
  });

  it('rejects a delivery no provider recognises', async () => {
    const { webhookId, secret } = await setupProject();
    const res = await deliverRaw(webhookId, prPayload({}), { 'x-hub-signature-256': secret });
    expect(res.status).toBe(400);
  });

  it('still accepts deliveries on the legacy GitHub path', async () => {
    const { asOwner, webhookId, secret, columns } = await setupProject();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    const done = columns.find((c) => c.stateType === 'completed')!;
    const payload = prPayload({ body: `Fixes MKT-${issue.sequenceNumber}` });
    const body = JSON.stringify(payload);

    const res = await app.handle(
      new Request(`http://localhost/webhooks/github/${webhookId}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-github-event': 'pull_request',
          'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
          'x-github-delivery': crypto.randomUUID(),
        },
        body,
      }),
    );
    expect(res.status).toBe(200);
    expect((await issueState(asOwner, issue.id)).columnId).toBe(done.id);
  });
});
