import { createHmac, generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../../../../app';
import { authedApi, createProject, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';
import { appKeyPair, isValidAppJwt } from '../helpers';

// A team connects GitHub through a GitHub App. The SSRF guard refuses http and loopback
// hosts under NODE_ENV=test, so each case runs as development against a GitHub served on
// localhost. Every fake has its own installation id, which is part of the token cache key,
// so no case sees a token another one minted.

const APP_ID = '4242';
const PREFIX = '/api/v3';
let installations = 3000;

const keys = appKeyPair();

interface Hook {
  id: number;
  url: string;
  secret: string;
}

const repository = {
  id: 1,
  full_name: 'acme/site',
  html_url: 'https://git.example/acme/site',
  private: true,
  default_branch: 'main',
  permissions: { admin: false, push: true },
};

function fakeGithub({
  tokenSeconds = 3600,
  appId = APP_ID,
}: { tokenSeconds?: number; appId?: string } = {}) {
  const installationId = String(++installations);
  const token = `ghs_${installationId}`;
  const hooks = new Map<number, Hook>();
  const pulls: { authorization: string | null; body: Record<string, unknown> }[] = [];
  const comments: { authorization: string | null; path: string; body: string }[] = [];
  let nextHookId = 1;
  let mints = 0;
  let mintStatus: number | null = null;
  let mintHeaders: Record<string, string> = {};
  let hookDeleteStatus: number | null = null;
  let revoked = false;
  let accountLogin = 'acme';

  const showHook = (hook: Hook) => ({ id: hook.id, config: { url: hook.url } });
  const readHook = (body: Record<string, unknown>) => {
    const config = body.config as Record<string, string>;
    return { url: config.url!, secret: config.secret! };
  };

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const path = new URL(req.url).pathname.slice(PREFIX.length);
      const authorization = req.headers.get('authorization');
      if (path.startsWith('/app/')) {
        if (!isValidAppJwt(authorization, appId, keys.publicKey)) {
          return Response.json({ message: 'Bad credentials' }, { status: 401 });
        }
        const installation = `/app/installations/${installationId}`;
        if (path === installation && req.method === 'GET') {
          return Response.json({ id: Number(installationId), account: { login: accountLogin } });
        }
        if (path === `${installation}/access_tokens` && req.method === 'POST') {
          mints += 1;
          if (mintStatus) {
            return Response.json(
              { message: 'Failed' },
              { status: mintStatus, headers: mintHeaders },
            );
          }
          return Response.json(
            { token, expires_at: new Date(Date.now() + tokenSeconds * 1000).toISOString() },
            { status: 201 },
          );
        }
        return Response.json({ message: 'Not Found' }, { status: 404 });
      }
      if (path === '/user') return Response.json({ login: 'acme' });
      if (revoked || authorization !== `Bearer ${token}`) {
        return Response.json({ message: 'Bad credentials' }, { status: 401 });
      }
      if (path === '/installation/repositories') {
        return Response.json({ total_count: 1, repositories: [repository] });
      }
      if (path === '/repositories/1') return Response.json(repository);
      const hooksPath = '/repos/acme/site/hooks';
      if (path === hooksPath && req.method === 'GET') {
        return Response.json([...hooks.values()].map(showHook));
      }
      if (path === hooksPath && req.method === 'POST') {
        const hook = {
          id: nextHookId++,
          ...readHook((await req.json()) as Record<string, unknown>),
        };
        hooks.set(hook.id, hook);
        return Response.json(showHook(hook), { status: 201 });
      }
      const hook = hooks.get(Number(path.match(/^\/repos\/acme\/site\/hooks\/(\d+)$/)?.[1]));
      if (hook && req.method === 'PATCH') {
        Object.assign(hook, readHook((await req.json()) as Record<string, unknown>));
        return Response.json(showHook(hook));
      }
      if (hook && req.method === 'DELETE') {
        if (hookDeleteStatus) {
          return Response.json({ message: 'Forbidden' }, { status: hookDeleteStatus });
        }
        hooks.delete(hook.id);
        return new Response(null, { status: 204 });
      }
      if (path === '/repos/acme/site/pulls' && req.method === 'POST') {
        const body = (await req.json()) as Record<string, unknown>;
        pulls.push({ authorization, body });
        return Response.json(
          {
            number: 7,
            title: body.title,
            body: body.body,
            state: 'open',
            draft: false,
            html_url: 'https://git.example/acme/site/pull/7',
            updated_at: new Date().toISOString(),
            base: { ref: body.base },
            head: { ref: body.head, sha: 'head-sha-1' },
          },
          { status: 201 },
        );
      }
      if (/^\/repos\/acme\/site\/issues\/\d+\/comments$/.test(path) && req.method === 'POST') {
        const body = (await req.json()) as { body: string };
        comments.push({ authorization, path, body: body.body });
        return Response.json({ id: 1 }, { status: 201 });
      }
      return Response.json({ message: 'Not Found' }, { status: 404 });
    },
  });

  return {
    baseUrl: `http://127.0.0.1:${server.port}`,
    installationId,
    token,
    hooks,
    pulls,
    comments,
    mints: () => mints,
    failMints: (status: number, headers: Record<string, string> = {}) => {
      mintStatus = status;
      mintHeaders = headers;
    },
    failHookDeletes: (status: number) => {
      hookDeleteStatus = status;
    },
    revokeToken: () => {
      revoked = true;
    },
    renameAccount: (login: string) => {
      accountLogin = login;
    },
    stop: () => server.stop(true),
  };
}

type Fake = ReturnType<typeof fakeGithub>;

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const created = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  return { asOwner, teamId: created.data!.teamId };
}

function connectApp(
  asOwner: Api,
  teamId: number,
  fake: Fake,
  overrides: { appId?: string; installationId?: string; privateKey?: string } = {},
) {
  return asOwner.teams({ teamId }).settings.git.connections['github-app'].post({
    baseUrl: fake.baseUrl,
    appId: APP_ID,
    installationId: fake.installationId,
    privateKey: keys.privateKey,
    ...overrides,
  });
}

async function connectedApp(asOwner: Api, teamId: number, fake: Fake) {
  const response = await connectApp(asOwner, teamId, fake);
  expect(response.status).toBe(201);
  return response.data!;
}

async function connectRepository(asOwner: Api, connectionId: number) {
  const response = await asOwner
    .projects({ projectKey: 'MKT' })
    .settings.git.connections({ connectionId })
    .repositories.post({ externalIds: ['1'] });
  expect(response.status).toBe(200);
  return response.data!.repositories[0]!;
}

function teamConnections(asOwner: Api, teamId: number) {
  return asOwner.teams({ teamId }).settings.git.connections.get();
}

describe('GitHub App connection', () => {
  const environment = { ...process.env };
  let fake: Fake;

  beforeEach(async () => {
    await resetDb();
    process.env.NODE_ENV = 'development';
    delete process.env.GIT_WEBHOOK_BASE_URL;
  });

  afterEach(() => {
    fake?.stop();
    process.env.NODE_ENV = environment.NODE_ENV;
    if (environment.GIT_WEBHOOK_BASE_URL === undefined) delete process.env.GIT_WEBHOOK_BASE_URL;
    else process.env.GIT_WEBHOOK_BASE_URL = environment.GIT_WEBHOOK_BASE_URL;
  });

  it('connects an installation and never returns key material', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();

    const response = await connectApp(asOwner, teamId, fake);

    expect(response.status).toBe(201);
    expect(response.data).toMatchObject({
      provider: 'github',
      authType: 'github_app',
      baseUrl: fake.baseUrl,
      accountLogin: 'acme',
      repositories: [],
    });
    const body = JSON.stringify(response.data);
    expect(body).not.toContain('PRIVATE KEY');
    expect(body).not.toContain(fake.token);
    expect(body).not.toMatch(/ciphertext|authTag|privateKey/);

    const listed = await teamConnections(asOwner, teamId);
    expect(listed.data).toEqual([response.data!]);
  });

  it('lists repositories the App can reach without admin permission and connects one', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();
    const connection = await connectedApp(asOwner, teamId, fake);

    const available = await asOwner
      .projects({ projectKey: 'MKT' })
      .settings.git.connections({ connectionId: connection.id })
      .repositories.get({ query: {} });
    expect(available.data!.repositories).toEqual([
      {
        externalId: '1',
        fullName: 'acme/site',
        webUrl: 'https://git.example/acme/site',
        private: true,
        managedRepositoryId: null,
      },
    ]);

    const connected = await connectRepository(asOwner, connection.id);
    expect(connected).toMatchObject({ fullName: 'acme/site', status: 'connected' });
    expect([...fake.hooks.values()]).toMatchObject([{ id: 1 }]);
    expect(fake.mints()).toBe(1);
  });

  it('sends the installation token when a pull request is created for an issue', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();
    const connection = await connectedApp(asOwner, teamId, fake);
    const managed = await connectRepository(asOwner, connection.id);
    const view = await asOwner.projects({ projectKey: 'MKT' }).get();
    const issue = await asOwner
      .projects({ projectKey: 'MKT' })
      .issues.post({ columnId: view.data!.columns[0]!.id, title: 'Task' });

    const created = await asOwner
      .issues({ issueId: issue.data!.id })
      .development['pull-requests'].post({
        repositoryId: managed.id,
        sourceBranch: 'feature/site',
        targetBranch: 'main',
        title: 'Add the site',
        description: 'Body',
        draft: false,
      });

    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({ provider: 'github', repository: 'acme/site', number: 7 });
    expect(fake.pulls).toMatchObject([
      {
        authorization: `Bearer ${fake.token}`,
        body: { head: 'feature/site', base: 'main', title: 'Add the site' },
      },
    ]);
    expect(fake.mints()).toBe(1);
  });

  it('posts the linkback comment with the installation token', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();
    const connection = await connectedApp(asOwner, teamId, fake);
    await connectRepository(asOwner, connection.id);
    const view = await asOwner.projects({ projectKey: 'MKT' }).get();
    await asOwner
      .projects({ projectKey: 'MKT' })
      .issues.post({ columnId: view.data!.columns[0]!.id, title: 'Task' });
    await asOwner.projects({ projectKey: 'MKT' }).settings.git.patch({ enabled: true });
    const settings = (await asOwner.projects({ projectKey: 'MKT' }).settings.git.get()).data!;

    const payload = JSON.stringify({
      action: 'opened',
      pull_request: {
        number: 42,
        title: 'Closes MKT-1',
        body: null,
        html_url: 'https://git.example/acme/site/pull/42',
        merged: false,
        draft: false,
        base: { ref: 'main' },
        head: { ref: 'feature/site', sha: 'head-sha-1' },
      },
      repository: { full_name: 'acme/site', default_branch: 'main' },
    });
    const delivered = await app.handle(
      new Request(`http://localhost/webhooks/git/${settings.webhookId}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-github-event': 'pull_request',
          'x-hub-signature-256': `sha256=${createHmac('sha256', settings.secret).update(payload).digest('hex')}`,
          'x-github-delivery': crypto.randomUUID(),
        },
        body: payload,
      }),
    );

    expect(delivered.status).toBe(200);
    expect(fake.comments).toMatchObject([
      { authorization: `Bearer ${fake.token}`, path: '/repos/acme/site/issues/42/comments' },
    ]);
  });

  it('updates the hooks of its repositories when the App is connected again', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();
    const connection = await connectedApp(asOwner, teamId, fake);
    await connectRepository(asOwner, connection.id);

    process.env.GIT_WEBHOOK_BASE_URL = 'https://hooks.example.com';
    await connectedApp(asOwner, teamId, fake);

    expect([...fake.hooks.values()]).toMatchObject([
      { id: 1, url: expect.stringContaining('https://hooks.example.com/webhooks/git/') },
    ]);
    const listed = await teamConnections(asOwner, teamId);
    expect(listed.data![0]!.repositories).toMatchObject([
      { fullName: 'acme/site', status: 'connected', lastError: null },
    ]);
  });

  it('refuses a private key that is not a PEM key', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();

    const response = await connectApp(asOwner, teamId, fake, { privateKey: 'not a key' });

    expect(response.status).toBe(400);
    expect(response.error?.value).toMatchObject({
      error: 'privateKey is not a valid PEM private key',
    });
    expect((await teamConnections(asOwner, teamId)).data).toEqual([]);
  });

  it('refuses an RSA private key of an unsupported size', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();
    const small = generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey.export({
      type: 'pkcs8',
      format: 'pem',
    }) as string;

    const response = await connectApp(asOwner, teamId, fake, { privateKey: small });

    expect(response.status).toBe(400);
    expect(response.error?.value).toMatchObject({
      error: 'privateKey must be a 2048- to 4096-bit RSA key',
    });
    expect((await teamConnections(asOwner, teamId)).data).toEqual([]);
  });

  it('refuses a private key longer than 8192 characters', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();

    const response = await connectApp(asOwner, teamId, fake, { privateKey: 'x'.repeat(8193) });

    expect(response.status).toBe(400);
    expect(response.error?.value).toMatchObject({ error: expect.stringMatching(/length/i) });
    expect(fake.mints()).toBe(0);
  });

  it('refuses an installation GitHub does not know', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();

    const response = await connectApp(asOwner, teamId, fake, { installationId: '9' });

    expect(response.status).toBe(400);
    expect(response.error?.value).toMatchObject({
      error: 'GitHub could not find this installation of the App.',
    });
    expect((await teamConnections(asOwner, teamId)).data).toEqual([]);
  });

  it('rejects an App ID or installation ID of the wrong shape', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();

    const spaced = await connectApp(asOwner, teamId, fake, { appId: '42 42' });
    const text = await connectApp(asOwner, teamId, fake, { installationId: 'abc' });

    expect(spaced.status).toBe(400);
    expect(spaced.error?.value).toMatchObject({ error: expect.stringMatching(/to match/) });
    expect(text.status).toBe(400);
    expect(text.error?.value).toMatchObject({ error: expect.stringMatching(/to match/) });
    expect(fake.mints()).toBe(0);
  });

  it('accepts a legacy Client ID with a dot as the App ID', async () => {
    fake = fakeGithub({ appId: 'Iv1.abc123' });
    const { asOwner, teamId } = await setup();

    const response = await connectApp(asOwner, teamId, fake, { appId: 'Iv1.abc123' });

    expect(response.status).toBe(201);
    expect(response.data).toMatchObject({ authType: 'github_app', accountLogin: 'acme' });
  });

  it('refuses a member who is neither owner nor manager', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();
    const asMember = await addProjectMember(asOwner, 'MKT');

    const response = await connectApp(asMember, teamId, fake);

    expect(response.status).toBe(403);
    expect((await teamConnections(asOwner, teamId)).data).toEqual([]);
  });

  it('updates the connection when the same installation is connected again', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();
    const first = await connectedApp(asOwner, teamId, fake);
    fake.renameAccount('acme-renamed');

    const second = await connectedApp(asOwner, teamId, fake);

    expect(second.id).toBe(first.id);
    expect(second.accountLogin).toBe('acme-renamed');
    expect(new Date(second.createdAt).getTime()).toBe(new Date(first.createdAt).getTime());
    expect((await teamConnections(asOwner, teamId)).data).toHaveLength(1);
  });

  it('keeps the App connection when a personal token of the same login is saved', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();
    const appConnection = await connectedApp(asOwner, teamId, fake);

    const saved = await asOwner
      .teams({ teamId })
      .settings.git.connections.post({ provider: 'github', baseUrl: fake.baseUrl, token: 'pat-1' });

    expect(saved.status).toBe(201);
    expect(saved.data).toMatchObject({ authType: 'token', accountLogin: 'acme' });
    expect(saved.data!.id).not.toBe(appConnection.id);
    const listed = (await teamConnections(asOwner, teamId)).data!;
    expect(listed.map((item) => item.authType).sort()).toEqual(['github_app', 'token']);
    expect(listed.find((item) => item.id === appConnection.id)).toEqual(appConnection);
  });

  it('removes the webhooks with the installation token when the App connection is deleted', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();
    const connection = await connectedApp(asOwner, teamId, fake);
    await connectRepository(asOwner, connection.id);
    expect(fake.hooks.size).toBe(1);

    const removed = await asOwner
      .teams({ teamId })
      .settings.git.connections({ connectionId: connection.id })
      .delete();

    expect(removed.status).toBe(204);
    expect(fake.hooks.size).toBe(0);
    expect((await teamConnections(asOwner, teamId)).data).toEqual([]);
  });

  it('deletes the connection of an uninstalled App whose revoked token is still cached', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();
    const connection = await connectedApp(asOwner, teamId, fake);
    await connectRepository(asOwner, connection.id);
    fake.failMints(404);
    fake.revokeToken();

    const removed = await asOwner
      .teams({ teamId })
      .settings.git.connections({ connectionId: connection.id })
      .delete();

    expect(removed.status).toBe(204);
    expect(fake.mints()).toBe(2);
    expect(fake.hooks.size).toBe(1);
    expect((await teamConnections(asOwner, teamId)).data).toEqual([]);
  });

  it('keeps the connection and its webhooks when GitHub rate-limits the token mint', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();
    const connection = await connectedApp(asOwner, teamId, fake);
    await connectRepository(asOwner, connection.id);
    fake.failMints(403, { 'x-ratelimit-remaining': '0' });

    const removed = await asOwner
      .teams({ teamId })
      .settings.git.connections({ connectionId: connection.id })
      .delete();

    expect(removed.status).toBe(400);
    expect(removed.error?.value).toMatchObject({
      error: 'GitHub API rate limit reached. Wait for it to reset and try again.',
    });
    expect((await teamConnections(asOwner, teamId)).data).toHaveLength(1);
    expect(fake.hooks.size).toBe(1);
  });

  it('keeps the connection when GitHub refuses to delete a webhook', async () => {
    fake = fakeGithub();
    const { asOwner, teamId } = await setup();
    const connection = await connectedApp(asOwner, teamId, fake);
    await connectRepository(asOwner, connection.id);
    fake.failHookDeletes(403);

    const removed = await asOwner
      .teams({ teamId })
      .settings.git.connections({ connectionId: connection.id })
      .delete();

    expect(removed.status).toBe(400);
    expect((await teamConnections(asOwner, teamId)).data).toHaveLength(1);
    expect(fake.hooks.size).toBe(1);
  });

  it('marks the repositories of an uninstalled App when the webhook secret is regenerated', async () => {
    // A token with under five minutes left is minted again on the next use.
    fake = fakeGithub({ tokenSeconds: 60 });
    const { asOwner, teamId } = await setup();
    const connection = await connectedApp(asOwner, teamId, fake);
    await connectRepository(asOwner, connection.id);
    fake.failMints(404);

    const regenerated = await asOwner.projects({ projectKey: 'MKT' }).settings.git.secret.post();

    expect(regenerated.status).toBe(200);
    const connections = await asOwner
      .projects({ projectKey: 'MKT' })
      .settings.git.connections.get();
    expect(connections.data![0]!.repositories).toMatchObject([
      { status: 'error', lastError: 'GitHub could not find this installation of the App.' },
    ]);
  });
});
