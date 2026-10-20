import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// Webhooks the instance manages through a provider connection, against a provider served
// on localhost. The SSRF guard refuses http and loopback hosts under NODE_ENV=test, so
// each case runs as development, the way the @repo/net tests reach a local server.

type FakeProvider = 'github' | 'gitea' | 'gitlab';

const API_PREFIX: Record<FakeProvider, string> = {
  github: '/api/v3',
  gitea: '/api/v1',
  gitlab: '/api/v4',
};

interface Hook {
  id: number;
  url: string;
  secret: string;
}

function fakeProvider(provider: FakeProvider) {
  const hooks = new Map<number, Hook>();
  let nextId = 1;
  const prefix = API_PREFIX[provider];
  const hooksPath = provider === 'gitlab' ? '/projects/1/hooks' : '/repos/acme/site/hooks';
  const show = (hook: Hook) =>
    provider === 'gitlab'
      ? { id: hook.id, url: hook.url }
      : { id: hook.id, config: { url: hook.url, content_type: 'json' } };
  const read = (body: Record<string, unknown>) => {
    if (provider === 'gitlab') return { url: body.url as string, secret: body.token as string };
    const config = body.config as Record<string, string>;
    return { url: config.url!, secret: config.secret! };
  };

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const path = new URL(req.url).pathname.slice(prefix.length);
      if (path === '/user') return Response.json({ login: 'octo', username: 'octo' });
      if (path === '/repositories/1' || path === '/projects/1') {
        return Response.json({
          id: 1,
          full_name: 'acme/site',
          path_with_namespace: 'acme/site',
          html_url: 'https://git.example/acme/site',
          web_url: 'https://git.example/acme/site',
          permissions: { admin: true },
        });
      }
      if (path === hooksPath && req.method === 'GET') {
        return Response.json([...hooks.values()].map(show));
      }
      if (path === hooksPath && req.method === 'POST') {
        const hook = { id: nextId++, ...read((await req.json()) as Record<string, unknown>) };
        hooks.set(hook.id, hook);
        return Response.json(show(hook), { status: 201 });
      }
      const match = path.match(/\/hooks\/(\d+)$/);
      const hook = match ? hooks.get(Number(match[1])) : undefined;
      if (match && (req.method === 'PATCH' || req.method === 'PUT')) {
        if (!hook) return Response.json({ message: 'Not Found' }, { status: 404 });
        Object.assign(hook, read((await req.json()) as Record<string, unknown>));
        return Response.json(show(hook));
      }
      return Response.json({ message: 'Not Found' }, { status: 404 });
    },
  });
  return { baseUrl: `http://127.0.0.1:${server.port}`, hooks, stop: () => server.stop(true) };
}

async function setup(provider: FakeProvider, fake: ReturnType<typeof fakeProvider>) {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const created = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const teamId = created.data!.teamId;
  const connection = await saveToken(asOwner, teamId, provider, fake.baseUrl);
  const connected = await asOwner
    .projects({ projectKey: 'MKT' })
    .settings.git.connections({ connectionId: connection.id })
    .repositories.post({ externalIds: ['1'] });
  expect(connected.status).toBe(200);
  return { asOwner, teamId };
}

async function saveToken(asOwner: Api, teamId: number, provider: FakeProvider, baseUrl: string) {
  const response = await asOwner
    .teams({ teamId })
    .settings.git.connections.post({ provider, baseUrl, token: 'token-1' });
  expect(response.status).toBe(201);
  return response.data!;
}

async function settings(asOwner: Api) {
  return (await asOwner.projects({ projectKey: 'MKT' }).settings.git.get()).data!;
}

describe('Managed repository webhooks', () => {
  const environment = { ...process.env };
  let fake: ReturnType<typeof fakeProvider> | null = null;

  beforeEach(async () => {
    await resetDb();
    process.env.NODE_ENV = 'development';
    delete process.env.GIT_WEBHOOK_BASE_URL;
  });

  afterEach(() => {
    fake?.stop();
    fake = null;
    process.env.NODE_ENV = environment.NODE_ENV;
    if (environment.GIT_WEBHOOK_BASE_URL === undefined) delete process.env.GIT_WEBHOOK_BASE_URL;
    else process.env.GIT_WEBHOOK_BASE_URL = environment.GIT_WEBHOOK_BASE_URL;
  });

  it('builds the payload URL from API_URL when GIT_WEBHOOK_BASE_URL is unset', async () => {
    fake = fakeProvider('github');
    const { asOwner } = await setup('github', fake);

    const current = await settings(asOwner);
    expect(current.payloadUrl).toBe(`${process.env.API_URL}/webhooks/git/${current.webhookId}`);
    expect([...fake.hooks.values()]).toMatchObject([{ url: current.payloadUrl }]);
  });

  it('builds the payload URL from GIT_WEBHOOK_BASE_URL when it is set', async () => {
    process.env.GIT_WEBHOOK_BASE_URL = 'https://hooks.example.com/';
    fake = fakeProvider('github');
    const { asOwner } = await setup('github', fake);

    const current = await settings(asOwner);
    expect(current.payloadUrl).toBe(`https://hooks.example.com/webhooks/git/${current.webhookId}`);
    expect([...fake.hooks.values()]).toMatchObject([{ url: current.payloadUrl }]);
  });

  for (const provider of ['github', 'gitea', 'gitlab'] as const) {
    it(`updates the stored ${provider} hook in place when the base URL changes`, async () => {
      fake = fakeProvider(provider);
      const { asOwner, teamId } = await setup(provider, fake);

      process.env.GIT_WEBHOOK_BASE_URL = 'https://hooks.example.com';
      await saveToken(asOwner, teamId, provider, fake.baseUrl);

      const current = await settings(asOwner);
      expect(current.payloadUrl).toStartWith('https://hooks.example.com/webhooks/git/');
      expect([...fake.hooks.values()]).toMatchObject([{ id: 1, url: current.payloadUrl }]);
    });
  }

  it('updates a hook whose URL was edited by hand instead of adding a second one', async () => {
    fake = fakeProvider('github');
    const { asOwner, teamId } = await setup('github', fake);
    fake.hooks.get(1)!.url = 'https://edited.example.com/webhooks/git/x';

    await saveToken(asOwner, teamId, 'github', fake.baseUrl);

    const current = await settings(asOwner);
    expect([...fake.hooks.values()]).toMatchObject([{ id: 1, url: current.payloadUrl }]);
  });

  it('sends a regenerated secret to the stored hook', async () => {
    fake = fakeProvider('github');
    const { asOwner } = await setup('github', fake);
    process.env.GIT_WEBHOOK_BASE_URL = 'https://hooks.example.com';

    const regenerated = await asOwner.projects({ projectKey: 'MKT' }).settings.git.secret.post();

    expect(regenerated.data!.payloadUrl).toStartWith('https://hooks.example.com/webhooks/git/');
    expect([...fake.hooks.values()]).toEqual([
      { id: 1, url: regenerated.data!.payloadUrl, secret: regenerated.data!.secret },
    ]);
  });

  it('creates the hook again when the stored one is gone', async () => {
    fake = fakeProvider('github');
    const { asOwner } = await setup('github', fake);
    fake.hooks.delete(1);

    const regenerated = await asOwner.projects({ projectKey: 'MKT' }).settings.git.secret.post();

    expect([...fake.hooks.values()]).toEqual([
      { id: 2, url: regenerated.data!.payloadUrl, secret: regenerated.data!.secret },
    ]);
    const connections = await asOwner
      .projects({ projectKey: 'MKT' })
      .settings.git.connections.get();
    expect(connections.data![0]!.repositories).toMatchObject([
      { fullName: 'acme/site', status: 'connected', lastError: null },
    ]);
  });
});
