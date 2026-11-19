import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { app } from '../../../../app';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The provider runs on localhost. The SSRF guard refuses loopback hosts under
// NODE_ENV=test, so each case runs as development, as the managed webhook tests do.

type Server = 'gitea' | 'forgejo' | 'github' | 'gitlab';

const API_PREFIX: Record<Server, string> = {
  gitea: '/api/v1',
  forgejo: '/api/v1',
  github: '/api/v3',
  gitlab: '/api/v4',
};

interface Pull {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  merged_at: string | null;
  draft: boolean;
  html_url: string;
  updated_at: string;
  head: { ref: string; sha: string };
  base: { ref: string };
}

function pull(number: number, title: string, state: 'open' | 'closed' = 'open'): Pull {
  return {
    number,
    title,
    body: '',
    state,
    merged_at: null,
    draft: /^(wip:|\[wip\])/i.test(title),
    html_url: `https://git.example/acme/site/pulls/${number}`,
    updated_at: '2026-11-01T10:00:00Z',
    head: { ref: `feature/${number}`, sha: `sha-${number}` },
    base: { ref: 'main' },
  };
}

// Pull requests and branches come one per page whatever page size is asked for, the way
// Gitea caps a page at its MAX_RESPONSE_ITEMS, and the next page is named only in Link.
function onePerPage(url: URL, items: unknown[]): Response {
  const page = Number(url.searchParams.get('page'));
  const headers = new Headers();
  if (page < items.length) headers.set('link', `<${url.href}>; rel="next"`);
  return Response.json(items.slice(page - 1, page), { headers });
}

function fakeServer(server: Server, { versionStatus }: { versionStatus?: number } = {}) {
  const pulls = [pull(7, 'Open change'), pull(8, 'Old change', 'closed')];
  const createdBodies: Record<string, unknown>[] = [];
  const repoPath = server === 'gitlab' ? '/projects/1' : '/repos/acme/site';
  const instance = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === '/api/forgejo/v1/version') {
        const status = versionStatus ?? (server === 'forgejo' ? 200 : 404);
        return Response.json({ version: '11.0.0' }, { status });
      }
      const path = url.pathname.slice(API_PREFIX[server].length);
      if (path === '/user') return Response.json({ login: 'octo', username: 'octo' });
      if (path === '/repositories/1' || path === '/projects/1') {
        return Response.json({
          id: 1,
          full_name: 'acme/site',
          path_with_namespace: 'acme/site',
          html_url: 'https://git.example/acme/site',
          web_url: 'https://git.example/acme/site',
          default_branch: 'main',
          permissions: { admin: true },
        });
      }
      if (path === `${repoPath}/hooks` && req.method === 'GET') return Response.json([]);
      if (path === `${repoPath}/hooks` && req.method === 'POST') {
        return Response.json({ id: 1, url: 'x', config: { url: 'x' } }, { status: 201 });
      }
      if (path === `${repoPath}/pulls` && req.method === 'GET') {
        const state = url.searchParams.get('state');
        return onePerPage(
          url,
          pulls.filter((item) => state === 'all' || item.state === state),
        );
      }
      if (path === `${repoPath}/pulls/7`) return Response.json(pulls[0]);
      if (path === `${repoPath}/branches`) {
        return onePerPage(url, [{ name: 'main' }, { name: 'feature/9' }]);
      }
      if (path === `${repoPath}/pulls` || path === `${repoPath}/merge_requests`) {
        const body = (await req.json()) as Record<string, string>;
        createdBodies.push(body);
        const created = {
          ...pull(9, body.title!),
          iid: 9,
          state: server === 'gitlab' ? 'opened' : 'open',
          source_branch: body.source_branch,
          target_branch: body.target_branch,
          head: { ref: body.head, sha: 'sha-9' },
          base: { ref: body.base },
        };
        return Response.json(created, { status: 201 });
      }
      return Response.json({ message: 'Not Found' }, { status: 404 });
    },
  });
  return {
    baseUrl: `http://127.0.0.1:${instance.port}`,
    createdBodies,
    stop: () => instance.stop(true),
  };
}

async function setup(connectionProvider: Server, fake: ReturnType<typeof fakeServer>) {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const created = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const connection = await asOwner
    .teams({ teamId: created.data!.teamId })
    .settings.git.connections.post({
      provider: connectionProvider,
      baseUrl: fake.baseUrl,
      token: 'token-1',
    });
  expect(connection.status).toBe(201);
  const connected = await asOwner
    .projects({ projectKey: 'MKT' })
    .settings.git.connections({ connectionId: connection.data!.id })
    .repositories.post({ externalIds: ['1'] });
  expect(connected.status).toBe(200);
  await asOwner.projects({ projectKey: 'MKT' }).settings.git.patch({ enabled: true });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const issue = await asOwner
    .projects({ projectKey: 'MKT' })
    .issues.post({ columnId: view.data!.columns[0]!.id, title: 'Task' });
  const issueId = issue.data!.id;
  const repositories = await asOwner.issues({ issueId }).development.repositories.get();
  return { asOwner, issueId, repositories, repositoryId: repositories.data![0]!.id };
}

// Merges pull request #7 the way a Gitea or Forgejo server reports it: GitHub-shaped,
// under its own event and signature headers. Forgejo sends the Gitea headers as well.
async function deliverMerge(asOwner: Api, server: 'gitea' | 'forgejo') {
  const { webhookId, secret } = (await asOwner.projects({ projectKey: 'MKT' }).settings.git.get())
    .data!;
  const body = JSON.stringify({
    action: 'closed',
    pull_request: { ...pull(7, 'Open change', 'closed'), merged: true },
    repository: { full_name: 'acme/site', default_branch: 'main' },
  });
  const signature = createHmac('sha256', secret!).update(body).digest('hex');
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-gitea-event': 'pull_request',
    'x-gitea-signature': signature,
    'x-gitea-delivery': crypto.randomUUID(),
  };
  if (server === 'forgejo') {
    headers['x-forgejo-event'] = 'pull_request';
    headers['x-forgejo-signature'] = signature;
  }
  return app.handle(
    new Request(`http://localhost/webhooks/git/${webhookId}`, { method: 'POST', headers, body }),
  );
}

async function developmentLinks(asOwner: Api, issueId: number) {
  return (await asOwner.issues({ issueId }).get()).data!.development;
}

describe('Gitea and Forgejo development links', () => {
  const environment = { ...process.env };
  let fake: ReturnType<typeof fakeServer> | null = null;

  beforeEach(async () => {
    await resetDb();
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    fake?.stop();
    fake = null;
    process.env.NODE_ENV = environment.NODE_ENV;
  });

  it('lists a Gitea repository and pages its pull requests by the Link header', async () => {
    fake = fakeServer('gitea');
    const { asOwner, issueId, repositories, repositoryId } = await setup('gitea', fake);
    expect(repositories.data).toMatchObject([{ provider: 'gitea', fullName: 'acme/site' }]);

    const pullRequests = asOwner.issues({ issueId }).development.repositories({ repositoryId })[
      'pull-requests'
    ];
    const first = await pullRequests.get({ query: { state: 'all', page: 1 } });
    const second = await pullRequests.get({ query: { state: 'all', page: 2 } });

    expect(first.data).toMatchObject({ pullRequests: [{ number: 7, state: 'open' }], nextPage: 2 });
    expect(second.data).toMatchObject({
      pullRequests: [{ number: 8, state: 'closed' }],
      nextPage: null,
    });
  });

  it('links an existing Gitea pull request that the server webhook then updates', async () => {
    fake = fakeServer('gitea');
    const { asOwner, issueId, repositoryId } = await setup('gitea', fake);

    const linked = await asOwner.issues({ issueId }).development.post({ repositoryId, number: 7 });

    expect(linked.status).toBe(201);
    expect(linked.data).toMatchObject({
      provider: 'gitea',
      repository: 'acme/site',
      number: 7,
      state: 'open',
      sourceBranch: 'feature/7',
      targetBranch: 'main',
    });
    const listed = await asOwner
      .issues({ issueId })
      .development.repositories({ repositoryId })
      ['pull-requests'].get({ query: { state: 'open', page: 1 } });
    expect(listed.data!.pullRequests).toMatchObject([{ number: 7, linked: true }]);

    expect((await deliverMerge(asOwner, 'gitea')).status).toBe(200);
    expect(await developmentLinks(asOwner, issueId)).toMatchObject([
      { provider: 'gitea', number: 7, state: 'merged' },
    ]);
  });

  it('pages Forgejo branches and creates a draft pull request with a WIP title', async () => {
    fake = fakeServer('forgejo');
    const { asOwner, issueId, repositoryId } = await setup('forgejo', fake);
    const branches = asOwner
      .issues({ issueId })
      .development.repositories({ repositoryId }).branches;
    expect((await branches.get({ query: { page: 1 } })).data).toEqual({
      branches: ['main'],
      defaultBranch: 'main',
      nextPage: 2,
    });
    expect((await branches.get({ query: { page: 2 } })).data).toMatchObject({
      branches: ['feature/9'],
      nextPage: null,
    });

    const created = await asOwner.issues({ issueId }).development['pull-requests'].post({
      repositoryId,
      sourceBranch: 'feature/9',
      targetBranch: 'main',
      title: 'Add login',
      description: 'Adds the login form.',
      draft: true,
    });

    expect(created.status).toBe(201);
    expect(fake.createdBodies).toEqual([
      { title: 'WIP: Add login', body: 'Adds the login form.', head: 'feature/9', base: 'main' },
    ]);
    expect(created.data).toMatchObject({ provider: 'forgejo', number: 9, draft: true });
  });

  it('keys a link made through a Gitea connection to a Forgejo server as Forgejo, so its webhooks update it', async () => {
    fake = fakeServer('forgejo');
    const { asOwner, issueId, repositoryId } = await setup('gitea', fake);
    const linked = await asOwner.issues({ issueId }).development.post({ repositoryId, number: 7 });
    expect(linked.data).toMatchObject({ provider: 'forgejo', number: 7, state: 'open' });

    expect((await deliverMerge(asOwner, 'forgejo')).status).toBe(200);
    expect(await developmentLinks(asOwner, issueId)).toMatchObject([
      { provider: 'forgejo', number: 7, state: 'merged' },
    ]);
  });

  it('keeps the connection provider when the Forgejo check is refused', async () => {
    fake = fakeServer('forgejo', { versionStatus: 403 });
    const { asOwner, issueId, repositoryId } = await setup('forgejo', fake);

    const linked = await asOwner.issues({ issueId }).development.post({ repositoryId, number: 7 });

    expect(linked.status).toBe(201);
    expect(linked.data).toMatchObject({ provider: 'forgejo', number: 7 });
  });

  const expectedBodies = {
    github: {
      title: 'Add login',
      body: 'Adds the login form.',
      head: 'feature/9',
      base: 'main',
      draft: true,
      maintainer_can_modify: true,
    },
    gitlab: {
      title: 'Draft: Add login',
      description: 'Adds the login form.',
      source_branch: 'feature/9',
      target_branch: 'main',
      allow_collaboration: true,
    },
  };

  for (const server of ['github', 'gitlab'] as const) {
    it(`creates a ${server} draft pull request with its own request body`, async () => {
      fake = fakeServer(server);
      const { asOwner, issueId, repositoryId } = await setup(server, fake);

      const created = await asOwner.issues({ issueId }).development['pull-requests'].post({
        repositoryId,
        sourceBranch: 'feature/9',
        targetBranch: 'main',
        title: 'Add login',
        description: 'Adds the login form.',
        draft: true,
      });

      expect(created.status).toBe(201);
      expect(fake.createdBodies).toEqual([expectedBodies[server]]);
      expect(created.data).toMatchObject({ provider: server, number: 9 });
    });
  }
});
