import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { auth } from '@repo/auth';
import { app, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// A member's own accounts on repository hosts, against a GitHub served on localhost. The
// SSRF guard refuses http and loopback hosts under NODE_ENV=test, so each case runs as
// development.

function fakeGithub() {
  const logins: Record<string, string> = { 'token-a': 'ana-gh', 'token-b': 'ana-work' };
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const token = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
      if (new URL(req.url).pathname !== '/api/v3/user')
        return Response.json({ message: 'Not Found' }, { status: 404 });
      const login = logins[token];
      const profile =
        login === 'ana-gh'
          ? { name: 'Ana Gomez', avatar_url: 'https://avatars.example/ana.png' }
          : {};
      return login
        ? Response.json({ id: login.length, login, ...profile })
        : Response.json({ message: 'Bad credentials' }, { status: 401 });
    },
  });
  return { baseUrl: `http://127.0.0.1:${server.port}`, stop: () => server.stop(true) };
}

describe('Repository host accounts', () => {
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

  it('names the account a token signs in as, without storing it', async () => {
    const ana = authedApi((await signUpTestUser()).cookie);

    const checked = await ana.account['git-accounts'].check.post({
      provider: 'github',
      baseUrl: `${fake.baseUrl}/`,
      token: 'token-a',
    });

    expect(checked.data).toEqual({
      provider: 'github',
      baseUrl: fake.baseUrl,
      accountLogin: 'ana-gh',
      accountName: 'Ana Gomez',
      avatarUrl: 'https://avatars.example/ana.png',
    });
    expect((await ana.account['git-accounts'].get()).data).toEqual([]);
  });

  it('refuses a token the host rejects and a host without issue sync', async () => {
    const ana = authedApi((await signUpTestUser()).cookie);

    const rejected = await ana.account['git-accounts'].check.post({
      provider: 'github',
      baseUrl: fake.baseUrl,
      token: 'wrong',
    });
    expect(rejected.status).toBe(400);
    expect(rejected.error!.value).toMatchObject({
      error: 'GitHub rejected the access token. Check that it is valid.',
    });

    const bitbucket = await ana.account['git-accounts'].post({
      // @ts-expect-error Bitbucket repositories cannot sync issues
      provider: 'bitbucket',
      token: 'token-a',
    });
    expect(bitbucket.status).toBe(400);
  });

  it('keeps one account per host, and only its owner sees or removes it', async () => {
    const ana = authedApi((await signUpTestUser()).cookie);
    const ben = authedApi((await signUpTestUser()).cookie);
    const accounts = ana.account['git-accounts'];

    const first = await accounts.post({
      provider: 'github',
      baseUrl: fake.baseUrl,
      token: 'token-a',
    });
    expect(first.status).toBe(201);
    await accounts.post({ provider: 'github', baseUrl: fake.baseUrl, token: 'token-b' });

    const listed = (await accounts.get()).data!;
    expect(listed).toMatchObject([
      { provider: 'github', baseUrl: fake.baseUrl, accountLogin: 'ana-work' },
    ]);
    expect((await ben.account['git-accounts'].get()).data).toEqual([]);

    const accountId = listed[0]!.id;
    expect((await ben.account['git-accounts']({ accountId }).delete()).status).toBe(404);
    expect((await accounts({ accountId }).delete()).status).toBe(204);
    expect((await accounts({ accountId }).delete()).status).toBe(404);
    expect((await accounts.get()).data).toEqual([]);
  });

  it('refuses an API key', async () => {
    const ana = await signUpTestUser();
    const key = await auth.api.createApiKey({ body: { userId: ana.userId, name: 'script' } });

    const res = await app.handle(
      new Request('http://localhost/account/git-accounts', { headers: { 'x-api-key': key.key } }),
    );

    expect(res.status).toBe(403);
  });
});
