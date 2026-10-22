import { beforeEach, describe, expect, it } from 'bun:test';
import { trustedOrigins } from '@repo/auth';
import { app, authedApi } from '../helpers/app';
import { signUpTestUser } from '../helpers/auth';
import { resetDb } from '../helpers/db';

// A page on a sibling subdomain is same-site to the api, so a lax session cookie
// reaches it. The api refuses such a state-changing request on every path but
// /api/auth/*, which better-auth guards itself.
const EVIL = 'https://evil.example.com';

// A team is created in a workspace; the user's own is the one sign-up gives them.
let workspaceId: number | null = null;

async function signUp() {
  const user = await signUpTestUser();
  workspaceId = user.workspaceId;
  return user;
}

function createTeam(headers: Record<string, string>, slug: string, path = '/teams') {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ name: slug, slug, workspaceId }),
    }),
  );
}

async function code(res: Response): Promise<string | undefined> {
  const body = (await res.json().catch(() => ({}))) as { code?: string };
  return body.code;
}

async function teamSlugs(cookie: string): Promise<(string | null)[]> {
  const teams = await authedApi(cookie).teams.get();
  return teams.data!.map((team) => team.slug);
}

describe('cross-site request guard', () => {
  beforeEach(resetDb);

  it('refuses a cookie request from an untrusted origin and changes nothing', async () => {
    const { cookie } = await signUp();
    const res = await createTeam({ cookie, origin: EVIL }, 'from-evil');
    expect(res.status).toBe(403);
    expect(await code(res)).toBe('CSRF_ORIGIN_REJECTED');
    expect(await teamSlugs(cookie)).not.toContain('from-evil');
  });

  it('refuses a cookie request with no Origin whose Sec-Fetch-Site is same-site', async () => {
    const { cookie } = await signUp();
    const res = await createTeam({ cookie, 'sec-fetch-site': 'same-site' }, 'no-origin');
    expect(res.status).toBe(403);
    expect(await code(res)).toBe('CSRF_ORIGIN_REJECTED');
  });

  it('accepts a cookie request from the web origin', async () => {
    const { cookie } = await signUp();
    const res = await createTeam({ cookie, origin: trustedOrigins[0]! }, 'from-web');
    expect(res.status).toBe(201);
    expect(await teamSlugs(cookie)).toContain('from-web');
  });

  it("accepts a cookie request from the api's own origin (the /docs page)", async () => {
    const { cookie } = await signUp();
    const apiOrigin = new URL(process.env.API_URL!).origin;
    const res = await createTeam({ cookie, origin: apiOrigin }, 'from-docs');
    expect(res.status).toBe(201);
  });

  it('accepts a cookie request without Origin or Sec-Fetch-Site (server-side calls)', async () => {
    const { cookie } = await signUp();
    const res = await createTeam({ cookie }, 'from-server');
    expect(res.status).toBe(201);
  });

  it('leaves api-key, bearer and cookieless requests to the usual auth', async () => {
    const others: Record<string, string>[] = [
      { 'x-api-key': 'ipk_unknown' },
      { authorization: 'Bearer x' },
      {},
    ];
    for (const headers of others) {
      const res = await createTeam({ ...headers, origin: EVIL }, 'other-auth');
      expect(await code(res)).not.toBe('CSRF_ORIGIN_REJECTED');
    }
  });

  it('does not let a bogus api key carry a cookie request past the guard', async () => {
    const { cookie } = await signUp();
    const res = await createTeam(
      { cookie, 'x-api-key': 'ipk_unknown', origin: EVIL },
      'key-and-cookie',
    );
    expect(res.status).toBe(401);
    expect(await teamSlugs(cookie)).not.toContain('key-and-cookie');
  });

  it('does not apply to /api/auth/*', async () => {
    const { cookie } = await signUp();
    const res = await createTeam({ cookie, origin: EVIL }, 'auth-path', '/api/auth/sign-out');
    expect(await code(res)).not.toBe('CSRF_ORIGIN_REJECTED');
  });
});
