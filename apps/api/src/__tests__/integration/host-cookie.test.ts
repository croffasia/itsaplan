import { beforeEach, describe, expect, it } from 'bun:test';
import { resetDb } from '#tests/helpers/db';

// The cookie names are fixed from the environment when @repo/auth loads, so each case
// loads it in a process of its own.
async function inspect(env: Record<string, string>) {
  const script = `
    const { auth } = await import('@repo/auth');
    const { authCookies } = await auth.$context;
    const res = await auth.handler(
      new Request(new URL(process.env.API_URL).origin + '/api/auth/sign-out', {
        method: 'POST',
        headers: { origin: new URL(process.env.APP_URL).origin },
      }),
    );
    console.log(JSON.stringify({ authCookies, signOut: res.headers.getSetCookie() }));
    process.exit(0);
  `;
  const proc = Bun.spawn([process.execPath, '-e', script], {
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  if ((await proc.exited) !== 0) throw new Error(err);
  return JSON.parse(out.trim().split('\n').pop()!) as {
    authCookies: Record<string, { name: string; attributes: Record<string, unknown> }>;
    signOut: string[];
  };
}

// Web at the root of its host and the api under /api, as deployed.
const HTTPS = { API_URL: 'https://app.example.test/api', APP_URL: 'https://app.example.test' };

// A sibling subdomain can plant a __Secure- cookie (with a Domain, or a narrower Path)
// that shadows the real one; a __Host- name is only accepted host-only at Path=/.
describe('session cookies use the __Host- prefix over HTTPS', () => {
  beforeEach(resetDb);

  it('names the session cookies __Host- with Path=/, Secure and no Domain', async () => {
    const { authCookies } = await inspect(HTTPS);

    for (const cookie of [
      authCookies.sessionToken!,
      authCookies.sessionData!,
      authCookies.dontRememberToken!,
    ]) {
      expect(cookie.name.startsWith('__Host-better-auth.')).toBe(true);
      expect(cookie.attributes.path).toBe('/');
      expect(cookie.attributes.secure).toBe(true);
      expect(cookie.attributes.domain).toBeUndefined();
    }
  });

  it('expires the __Host- cookie on sign-out in its one valid scope', async () => {
    const { signOut } = await inspect(HTTPS);

    const host = signOut.filter((c) => c.startsWith('__Host-better-auth.session_token=;'));
    expect(host.length).toBeGreaterThan(0);
    for (const cookie of host) {
      expect(cookie).toContain('Path=/');
      expect(cookie).not.toContain('Domain=');
    }
  });

  it('signs in and reads the session back through the __Host- cookie', async () => {
    const script = `
      const { auth } = await import('@repo/auth');
      const email = 'host-cookie-' + Date.now() + '@example.com';
      const res = await auth.api.signUpEmail({
        body: { email, password: 'test-password-123', name: 'Host Cookie' },
        asResponse: true,
      });
      const set = res.headers.getSetCookie();
      const cookie = set.map((c) => c.split(';')[0]).join('; ');
      const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
      console.log(JSON.stringify({ set, email: session?.user.email, expected: email }));
      process.exit(0);
    `;
    const proc = Bun.spawn([process.execPath, '-e', script], {
      env: { ...process.env, ...HTTPS },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [out, err] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    if ((await proc.exited) !== 0) throw new Error(err);
    const { set, email, expected } = JSON.parse(out.trim().split('\n').pop()!);

    expect(set.some((c: string) => c.startsWith('__Host-better-auth.session_token='))).toBe(true);
    expect(email).toBe(expected);
  });

  it('keeps the plain names over HTTP (local development)', async () => {
    const { authCookies } = await inspect({
      API_URL: 'http://localhost:3000',
      APP_URL: 'http://localhost:3001',
    });

    expect(authCookies.sessionToken!.name).toBe('better-auth.session_token');
  });

  it('keeps the __Secure- names on the parent domain when the api has its own subdomain', async () => {
    const { authCookies } = await inspect({
      API_URL: 'https://api.example.test',
      APP_URL: 'https://app.example.test',
    });

    const cookie = authCookies.sessionToken!;
    expect(cookie.name).toBe('__Secure-better-auth.session_token');
    expect(String(cookie.attributes.domain)).toContain('example.test');
    expect(cookie.attributes.path).toBe('/');
  });
});
