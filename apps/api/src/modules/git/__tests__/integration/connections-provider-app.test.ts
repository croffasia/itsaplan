import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  getProviderRepository,
  listProviderRepositories,
  type GitAuthType,
  type ProviderConnectionInput,
} from '../../connections-provider';

// The provider layer against a GitHub served on localhost. The SSRF guard refuses http and
// loopback hosts under NODE_ENV=test, so each case runs as development.

function githubRow(id: number, fullName: string, admin: boolean | null) {
  return {
    id,
    full_name: fullName,
    html_url: `https://github.com/${fullName}`,
    private: true,
    ...(admin === null ? {} : { permissions: { admin } }),
  };
}

function fakeGithub(rows: ReturnType<typeof githubRow>[], installationBody?: unknown) {
  const requests: {
    path: string;
    query: Record<string, string>;
    authorization: string | null;
  }[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname.slice('/api/v3'.length);
      requests.push({
        path,
        query: Object.fromEntries(url.searchParams),
        authorization: req.headers.get('authorization'),
      });
      if (path === '/installation/repositories') {
        return Response.json(installationBody ?? { total_count: rows.length, repositories: rows });
      }
      if (path === '/user/repos') return Response.json(rows);
      const match = path.match(/^\/repositories\/(\d+)$/);
      const row = match ? rows.find((item) => item.id === Number(match[1])) : undefined;
      if (row) return Response.json(row);
      return Response.json({ message: 'Not Found' }, { status: 404 });
    },
  });
  return {
    baseUrl: `http://127.0.0.1:${server.port}`,
    requests,
    stop: () => server.stop(true),
  };
}

describe('GitHub App installation provider layer', () => {
  const nodeEnv = process.env.NODE_ENV;
  let fake: ReturnType<typeof fakeGithub> | null = null;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    fake?.stop();
    fake = null;
    process.env.NODE_ENV = nodeEnv;
  });

  function connection(authType: GitAuthType): ProviderConnectionInput {
    return {
      provider: 'github',
      baseUrl: fake!.baseUrl,
      token: 'installation-token',
      authType,
    };
  }

  it('lists the installation repositories, admin or not, with the installation token', async () => {
    const rows = Array.from({ length: 30 }, (_, index) =>
      githubRow(index + 1, `acme/app-${index + 1}`, index % 2 === 0 ? false : null),
    );
    fake = fakeGithub(rows);

    const page = await listProviderRepositories(connection('github_app'), 2, '');

    expect(fake.requests).toEqual([
      {
        path: '/installation/repositories',
        query: { per_page: '30', page: '2' },
        authorization: 'Bearer installation-token',
      },
    ]);
    expect(page.repositories).toHaveLength(30);
    expect(page.repositories[0]).toMatchObject({ externalId: '1', fullName: 'acme/app-1' });
    expect(page.nextPage).toBe(3);
  });

  it('filters the installation repositories by full name', async () => {
    fake = fakeGithub([githubRow(1, 'acme/site', false), githubRow(2, 'acme/Api', false)]);

    const page = await listProviderRepositories(connection('github_app'), 1, 'api');

    expect(page.repositories.map((repo) => repo.fullName)).toEqual(['acme/Api']);
    expect(page.nextPage).toBeNull();
  });

  it('rejects an installation response without a repositories array', async () => {
    fake = fakeGithub([], [{ id: 1 }]);

    await expect(listProviderRepositories(connection('github_app'), 1, '')).rejects.toMatchObject({
      status: 502,
      message: 'github returned an invalid repository list',
    });
  });

  it('keeps the personal token path and its admin filter', async () => {
    fake = fakeGithub([githubRow(1, 'acme/reader', false), githubRow(2, 'acme/admin', true)]);

    const page = await listProviderRepositories(connection('token'), 1, '');

    expect(fake.requests[0]).toMatchObject({
      path: '/user/repos',
      authorization: 'Bearer installation-token',
    });
    expect(fake.requests[0]!.query).toMatchObject({ affiliation: expect.any(String) });
    expect(page.repositories.map((repo) => repo.fullName)).toEqual(['acme/admin']);
    await expect(getProviderRepository(connection('token'), '1')).rejects.toMatchObject({
      status: 400,
    });
    expect((await getProviderRepository(connection('token'), '2')).fullName).toBe('acme/admin');
  });
});
