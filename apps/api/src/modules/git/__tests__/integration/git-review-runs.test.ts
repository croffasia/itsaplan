import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { app } from '../../../../app';
import { createAgent } from '#tests/helpers/agents';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// A review is handed to the agent whose forge identity opened the pull request, on the
// connection the project manages the repository through, when the provider says the
// reviewer may write. The provider is served on localhost; the SSRF guard refuses
// loopback hosts under NODE_ENV=test, so each case runs as development, the way
// git-managed-webhooks.test.ts does.

// The permission each reviewer login has on acme/site.
const PERMISSIONS: Record<string, string> = { ann: 'write', rita: 'read', flaky: 'write' };

function fakeForgejo() {
  const state = { failPermission: true };
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const path = new URL(req.url).pathname.slice('/api/v1'.length);
      if (path === '/user') return Response.json({ login: 'itsaplan' });
      if (path === '/repositories/1') {
        return Response.json({
          id: 1,
          full_name: 'acme/site',
          html_url: 'https://git.example/acme/site',
          permissions: { admin: true },
        });
      }
      if (path === '/repos/acme/site/hooks' && req.method === 'GET') return Response.json([]);
      if (path === '/repos/acme/site/hooks' && req.method === 'POST') {
        return Response.json({ id: 1, config: { url: 'x' } }, { status: 201 });
      }
      const permission = path.match(/^\/repos\/acme\/site\/collaborators\/([^/]+)\/permission$/);
      if (permission) {
        const login = decodeURIComponent(permission[1]!);
        if (login === 'flaky' && state.failPermission) {
          return Response.json({ message: 'boom' }, { status: 500 });
        }
        return Response.json({ permission: PERMISSIONS[login] ?? 'none' });
      }
      return Response.json({ message: 'Not Found' }, { status: 404 });
    },
  });
  return { baseUrl: `http://127.0.0.1:${server.port}`, state, stop: () => server.stop(true) };
}

interface Setup {
  asOwner: Api;
  teamId: number;
  connectionId: number;
  agentId: number;
  webhookId: string;
  secret: string;
  columnId: number;
}

async function connect(asOwner: Api, teamId: number, baseUrl: string) {
  const connection = await asOwner
    .teams({ teamId })
    .settings.git.connections.post({ provider: 'forgejo', baseUrl, token: 'token-1' });
  expect(connection.status).toBe(201);
  return connection.data!.id;
}

async function setup(baseUrl: string, login = 'gilfoyle'): Promise<Setup> {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const created = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const teamId = created.data!.teamId;
  const project = asOwner.projects({ projectKey: 'MKT' });
  const connectionId = await connect(asOwner, teamId, baseUrl);
  const connected = await project.settings.git
    .connections({ connectionId })
    .repositories.post({ externalIds: ['1'] });
  expect(connected.status).toBe(200);
  await project.settings.git.patch({ enabled: true });
  const settings = (await project.settings.git.get()).data!;
  const agent = await createAgent(asOwner, 'MKT', {
    name: 'Gilfoyle',
    username: 'gilfoyle-agent',
    kind: 'external',
    triggerOnReview: true,
    forgeIdentities: [{ connectionId, login }],
  });
  expect(agent.status).toBe(201);
  const view = await project.get();
  return {
    asOwner,
    teamId,
    connectionId,
    agentId: agent.data!.agent.id,
    webhookId: settings.webhookId,
    secret: settings.secret!,
    columnId: view.data!.columns[0]!.id,
  };
}

async function deliver(s: Setup, event: string, payload: unknown, deliveryId?: string) {
  const body = JSON.stringify(payload);
  const res = await app.handle(
    new Request(`http://localhost/webhooks/git/${s.webhookId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forgejo-event': event,
        'x-gitea-event': event,
        'x-forgejo-signature': createHmac('sha256', s.secret).update(body).digest('hex'),
        'x-forgejo-delivery': deliveryId ?? crypto.randomUUID(),
      },
      body,
    }),
  );
  return { status: res.status, data: (await res.json().catch(() => null)) as unknown };
}

// An issue linked to pull request acme/site#42, opened on the host by `author`.
async function linkedIssue(s: Setup, author: string) {
  const issue = (
    await s.asOwner
      .projects({ projectKey: 'MKT' })
      .issues.post({ columnId: s.columnId, title: 'Task' })
  ).data!;
  await deliver(s, 'pull_request', {
    action: 'opened',
    pull_request: {
      number: 42,
      user: { login: author },
      title: 'Some change',
      body: `Fixes MKT-${issue.sequenceNumber}`,
      html_url: 'https://git.example/acme/site/pulls/42',
      merged: false,
      base: { ref: 'main' },
      head: { ref: 'feature/site', sha: 'head-sha-1' },
    },
    repository: { full_name: 'acme/site', default_branch: 'main' },
  });
  return issue;
}

function review(reviewer: string, author: string) {
  return {
    action: 'reviewed',
    number: 42,
    pull_request: {
      number: 42,
      html_url: 'https://git.example/acme/site/pulls/42',
      user: { login: author },
    },
    review: { type: 'pull_request_review_rejected', content: 'Not yet.' },
    sender: { login: reviewer },
    repository: { full_name: 'acme/site', default_branch: 'main' },
  };
}

const runsOf = (issueId: number) => db.select().from(agentRun).where(eq(agentRun.issueId, issueId));

async function reviewEntries(client: Api, issueId: number) {
  const feed = await client.issues({ issueId }).feed.get({ query: {} });
  return feed.data!.items.filter(
    (i: { action: string | null; payload: unknown }) =>
      i.action === 'git_pr' &&
      (i.payload as { subject?: { value?: string } }).subject?.value === 'changes_requested',
  );
}

function useFakes() {
  const environment = { ...process.env };
  let fakes: ReturnType<typeof fakeForgejo>[] = [];
  beforeEach(async () => {
    await resetDb();
    process.env.NODE_ENV = 'development';
  });
  afterEach(() => {
    for (const f of fakes) f.stop();
    fakes = [];
    process.env.NODE_ENV = environment.NODE_ENV;
  });
  return () => {
    const created = fakeForgejo();
    fakes.push(created);
    return created;
  };
}

describe('Review runs', () => {
  const fake = useFakes();

  it("hands a writer's review of a pull request its forge identity opened to the agent", async () => {
    const s = await setup(fake().baseUrl);
    const issue = await linkedIssue(s, 'Gilfoyle');

    const res = await deliver(s, 'pull_request_rejected', review('ann', 'Gilfoyle'));
    expect(res.data).toMatchObject({ handled: 'reviewed' });
    const runs = await runsOf(issue.id);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ agentId: s.agentId, trigger: 'review', status: 'pending' });
    expect(runs[0]!.prompt).toBe(
      'ann requested changes on pull request acme/site#42 (https://git.example/acme/site/pulls/42).\n\nNot yet.',
    );
  });

  it('only records a review by someone the provider says may not write', async () => {
    const s = await setup(fake().baseUrl);
    const issue = await linkedIssue(s, 'gilfoyle');

    await deliver(s, 'pull_request_rejected', review('rita', 'gilfoyle'));
    expect(await reviewEntries(s.asOwner, issue.id)).toHaveLength(1);
    expect(await runsOf(issue.id)).toHaveLength(0);
  });

  it("starts nothing for a pull request whose author is only the agent's username", async () => {
    const s = await setup(fake().baseUrl);
    const issue = await linkedIssue(s, 'gilfoyle-agent');

    await deliver(s, 'pull_request_rejected', review('ann', 'gilfoyle-agent'));
    expect(await reviewEntries(s.asOwner, issue.id)).toHaveLength(1);
    expect(await runsOf(issue.id)).toHaveLength(0);
  });

  it('starts nothing for a login bound on another host than the repository is managed through', async () => {
    const s = await setup(fake().baseUrl, 'someone-else');
    const other = await connect(s.asOwner, s.teamId, fake().baseUrl);
    const patched = await s.asOwner
      .teams({ teamId: s.teamId })
      ['ai-agents']({ agentId: s.agentId })
      .patch({ forgeIdentities: [{ connectionId: other, login: 'gilfoyle' }] });
    expect(patched.data!.forgeIdentities).toMatchObject([{ connectionId: other }]);
    const issue = await linkedIssue(s, 'gilfoyle');

    await deliver(s, 'pull_request_rejected', review('ann', 'gilfoyle'));
    expect(await runsOf(issue.id)).toHaveLength(0);
  });

  it('starts nothing for a review the author wrote', async () => {
    const s = await setup(fake().baseUrl);
    const issue = await linkedIssue(s, 'gilfoyle');

    await deliver(s, 'pull_request_rejected', review('gilfoyle', 'gilfoyle'));
    expect(await runsOf(issue.id)).toHaveLength(0);
  });

  it('leaves a review whose permission check failed free to be redelivered', async () => {
    const provider = fake();
    const s = await setup(provider.baseUrl);
    const issue = await linkedIssue(s, 'gilfoyle');
    const deliveryId = crypto.randomUUID();

    const failed = await deliver(
      s,
      'pull_request_rejected',
      review('flaky', 'gilfoyle'),
      deliveryId,
    );
    expect(failed.status).not.toBe(200);
    expect(await reviewEntries(s.asOwner, issue.id)).toHaveLength(0);

    provider.state.failPermission = false;
    const retried = await deliver(
      s,
      'pull_request_rejected',
      review('flaky', 'gilfoyle'),
      deliveryId,
    );
    expect(retried.data).toMatchObject({ handled: 'reviewed' });
    expect(await reviewEntries(s.asOwner, issue.id)).toHaveLength(1);
    expect(await runsOf(issue.id)).toHaveLength(1);
  });
});

describe('Agent forge identities', () => {
  const fake = useFakes();

  it('stores the logins lowercased with their host, and replaces the set on update', async () => {
    const provider = fake();
    const s = await setup(provider.baseUrl, '  GilFoyle ');
    const agent = s.asOwner.teams({ teamId: s.teamId })['ai-agents']({ agentId: s.agentId });
    expect((await agent.get()).data!.forgeIdentities).toEqual([
      {
        connectionId: s.connectionId,
        login: 'gilfoyle',
        provider: 'forgejo',
        baseUrl: provider.baseUrl,
      },
    ]);

    const cleared = await agent.patch({ forgeIdentities: [] });
    expect(cleared.data!.forgeIdentities).toEqual([]);
  });

  it('refuses a login another agent has on the same connection, creating nothing', async () => {
    const s = await setup(fake().baseUrl);
    const res = await createAgent(s.asOwner, 'MKT', {
      name: 'Mira',
      username: 'mira',
      kind: 'external',
      forgeIdentities: [{ connectionId: s.connectionId, login: 'GILFOYLE' }],
    });
    expect(res.status).toBe(409);
    const list = await s.asOwner.teams({ teamId: s.teamId })['ai-agents'].get({ query: {} });
    expect(list.data!.map((agent) => agent.username)).toEqual(['gilfoyle-agent']);
  });

  it('ignores a connection of another team', async () => {
    const s = await setup(fake().baseUrl);
    const stranger = authedApi((await signUpTestUser({ name: 'Stranger' })).cookie);
    const theirs = await createProject(stranger, { key: 'OPS', name: 'Ops' });
    const theirConnection = await connect(stranger, theirs.data!.teamId, fake().baseUrl);

    const res = await s.asOwner
      .teams({ teamId: s.teamId })
      ['ai-agents']({ agentId: s.agentId })
      .patch({ forgeIdentities: [{ connectionId: theirConnection, login: 'gilfoyle' }] });
    expect(res.status).toBe(200);
    expect(res.data!.forgeIdentities).toEqual([]);
  });
});
