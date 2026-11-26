import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The repositories a team connection or a member's own account reaches, against a GitHub
// served on localhost. The SSRF guard refuses http and loopback hosts under NODE_ENV=test,
// so each case runs as development.

function fakeGithub() {
  const site = {
    id: 1,
    full_name: 'acme/site',
    html_url: 'https://git.example/acme/site',
    permissions: { admin: true, push: true },
  };
  const docs = {
    id: 2,
    full_name: 'acme/docs',
    html_url: 'https://git.example/acme/docs',
    permissions: { admin: false, push: true },
  };
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const path = new URL(req.url).pathname.replace(/^\/api\/v3/, '');
      if (path === '/user') return Response.json({ id: 7, login: 'octo' });
      if (path === '/user/repos') return Response.json([site, docs]);
      if (path === '/repositories/1') return Response.json(site);
      if (path === '/repos/acme/site/hooks' && req.method === 'GET') return Response.json([]);
      if (path === '/repos/acme/site/hooks' && req.method === 'POST')
        return Response.json({ id: 1, config: { url: 'x' } }, { status: 201 });
      return Response.json({ message: 'Not Found' }, { status: 404 });
    },
  });
  return { baseUrl: `http://127.0.0.1:${server.port}`, stop: () => server.stop(true) };
}

describe('Repositories a token reaches', () => {
  const environment = { ...process.env };
  let fake: ReturnType<typeof fakeGithub>;

  beforeEach(async () => {
    await resetDb();
    process.env.NODE_ENV = 'development';
    fake = fakeGithub();
  });

  afterEach(() => {
    fake.stop();
    process.env.NODE_ENV = environment.NODE_ENV;
  });

  // Ana's team connection on the fake host, with acme/site synced to her project.
  async function syncedProject() {
    const ana = authedApi((await signUpTestUser()).cookie);
    const teamId = (await createProject(ana, { key: 'MKT', name: 'Marketing' })).data!.teamId;
    const connection = await ana
      .teams({ teamId })
      .settings.git.connections.post({ provider: 'github', baseUrl: fake.baseUrl, token: 't' });
    const connectionId = connection.data!.id;
    const synced = await ana
      .projects({ projectKey: 'MKT' })
      .settings.git.connections({ connectionId })
      .repositories.post({ externalIds: ['1'] });
    expect(synced.status).toBe(200);
    return { ana, teamId, connectionId };
  }

  it('lists the repositories a team connection manages webhooks in, with their projects', async () => {
    const { ana, teamId, connectionId } = await syncedProject();
    const ben = authedApi((await signUpTestUser()).cookie);
    const repositories = (connection: number) =>
      ana.teams({ teamId }).settings.git.connections({ connectionId: connection }).repositories;

    const listed = await repositories(connectionId).get({ query: {} });
    expect(listed.data).toEqual({
      repositories: [
        {
          externalId: '1',
          fullName: 'acme/site',
          webUrl: 'https://git.example/acme/site',
          projects: [{ id: expect.any(Number), name: 'Marketing' }],
        },
      ],
      nextPage: null,
    });
    expect((await repositories(connectionId + 1).get({ query: {} })).status).toBe(404);
    const outsider = await ben
      .teams({ teamId })
      .settings.git.connections({ connectionId })
      .repositories.get({ query: {} });
    expect(outsider.status).toBe(404);
  });

  it('lists the repositories a team connection syncs with projects, without the host', async () => {
    const { ana, teamId, connectionId } = await syncedProject();
    const ben = authedApi((await signUpTestUser()).cookie);
    const synced = (api: typeof ana, connection: number) =>
      api
        .teams({ teamId })
        .settings.git.connections({ connectionId: connection })
        ['synced-repositories'].get();
    fake.stop();

    expect((await synced(ana, connectionId)).data).toEqual([
      {
        externalId: '1',
        fullName: 'acme/site',
        webUrl: 'https://git.example/acme/site',
        projects: [{ id: expect.any(Number), name: 'Marketing' }],
      },
    ]);
    expect((await synced(ana, connectionId + 1)).status).toBe(404);
    expect((await synced(ben, connectionId)).status).toBe(404);
  });

  it("lists every repository a member's account reaches, with only their own projects", async () => {
    const { ana } = await syncedProject();
    const ben = authedApi((await signUpTestUser()).cookie);
    const connect = async (api: typeof ana) =>
      (
        await api.account['git-accounts'].post({
          provider: 'github',
          baseUrl: fake.baseUrl,
          token: 't',
        })
      ).data!.id;
    const anaAccount = await connect(ana);
    const benAccount = await connect(ben);

    const own = await ana.account['git-accounts']({ accountId: anaAccount }).repositories.get({
      query: { search: 'acme' },
    });
    expect(own.data).toEqual({
      repositories: [
        {
          externalId: '1',
          fullName: 'acme/site',
          webUrl: 'https://git.example/acme/site',
          projects: [{ id: expect.any(Number), name: 'Marketing' }],
        },
        {
          externalId: '2',
          fullName: 'acme/docs',
          webUrl: 'https://git.example/acme/docs',
          projects: [],
        },
      ],
      nextPage: null,
    });

    const outsider = await ben.account['git-accounts']({ accountId: benAccount }).repositories.get({
      query: {},
    });
    expect(outsider.data!.repositories.map((repository) => repository.projects)).toEqual([[], []]);
    const foreign = await ben.account['git-accounts']({ accountId: anaAccount }).repositories.get({
      query: {},
    });
    expect(foreign.status).toBe(404);

    const synced = (api: typeof ana, accountId: number) =>
      api.account['git-accounts']({ accountId })['synced-repositories'].get();
    expect((await synced(ana, anaAccount)).data).toEqual([
      {
        externalId: '1',
        fullName: 'acme/site',
        webUrl: 'https://git.example/acme/site',
        projects: [{ id: expect.any(Number), name: 'Marketing' }],
      },
    ]);
    expect((await synced(ben, benAccount)).data).toEqual([]);
    expect((await synced(ben, anaAccount)).status).toBe(404);
  });

  it('refuses a bad page or search and reports a host that cannot be reached', async () => {
    const { ana, teamId, connectionId } = await syncedProject();
    const accountId = (
      await ana.account['git-accounts'].post({
        provider: 'github',
        baseUrl: fake.baseUrl,
        token: 't',
      })
    ).data!.id;
    const lists = [
      ana.teams({ teamId }).settings.git.connections({ connectionId }).repositories,
      ana.account['git-accounts']({ accountId }).repositories,
    ];

    for (const list of lists) {
      expect((await list.get({ query: { page: 1, search: 'x'.repeat(200) } })).status).toBe(200);
      expect((await list.get({ query: { page: 0 } })).status).toBe(400);
      expect((await list.get({ query: { search: 'x'.repeat(201) } })).status).toBe(400);
    }
    fake.stop();
    for (const list of lists) expect((await list.get({ query: {} })).status).toBe(502);
  });
});
