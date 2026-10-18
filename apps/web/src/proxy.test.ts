import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

const COOKIE = 'better-auth.session_token=stale.signature';

let originalApiUrl: string | undefined;
let originalProxyTarget: string | undefined;

// A local apps/web/.env may set API_PROXY_TARGET; each test starts without it.
beforeEach(() => {
  originalApiUrl = process.env.API_URL;
  originalProxyTarget = process.env.API_PROXY_TARGET;
  delete process.env.API_PROXY_TARGET;
});

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.API_URL;
  else process.env.API_URL = originalApiUrl;
  if (originalProxyTarget === undefined) delete process.env.API_PROXY_TARGET;
  else process.env.API_PROXY_TARGET = originalProxyTarget;
});

function run(path: string, cookie?: string) {
  return proxy(
    new NextRequest(`http://localhost${path}`, {
      headers: cookie ? { cookie } : undefined,
    }),
  );
}

describe('proxy', () => {
  it('keeps a stale session on the expired screen instead of bouncing it back', () => {
    const res = run('/login?expired=1', COOKIE);
    assert.equal(res.headers.get('location'), null);
  });

  it('expires the stale cookies the api could not clear', () => {
    const res = run('/login?expired=1', `${COOKIE}; __Secure-better-auth.session_data=cached`);
    const cleared = res.headers.getSetCookie();
    assert.equal(cleared.length, 2);
    assert.match(cleared[0]!, /^better-auth\.session_token=;/);
    assert.match(cleared[0]!, /Expires=Thu, 01 Jan 1970/);
    // A `__Secure-` cookie is only accepted back with the attribute its name demands.
    assert.match(cleared[1]!, /^__Secure-better-auth\.session_data=;/);
    assert.match(cleared[1]!, /Secure/);
  });

  it('sends a signed-in user away from the login page', () => {
    const res = run('/login', COOKIE);
    assert.equal(res.headers.get('location'), 'http://localhost/');
  });

  it('leaves a signed-in user on the login page when it carries an error', () => {
    const res = run('/login?error=invalid_client', COOKIE);
    assert.equal(res.headers.get('location'), null);
  });

  // Over HTTPS the api names the session cookie with the __Host- prefix.
  it('treats a __Host- session cookie as a session', () => {
    const res = run('/login', '__Host-better-auth.session_token=value');
    assert.equal(res.headers.get('location'), 'http://localhost/');
  });

  it('expires a __Host- cookie only at Path=/, with Secure and no Domain', () => {
    const res = run('/login?expired=1', '__Host-better-auth.session_token=stale');
    const cleared = res.headers.getSetCookie();
    assert.equal(cleared.length, 1);
    assert.match(cleared[0]!, /^__Host-better-auth\.session_token=; Path=\/; Expires/);
    assert.match(cleared[0]!, /Secure/);
    assert.ok(!cleared[0]!.includes('Domain='));
  });

  it('sends a visitor without a session to the login page', () => {
    const res = run('/', undefined);
    assert.equal(res.headers.get('location'), 'http://localhost/login');
  });
});

describe('proxy security headers', () => {
  it('serves every page with a content security policy naming the api origin', () => {
    process.env.API_URL = 'http://api.test:3000/';
    const csp = run('/login').headers.get('content-security-policy');
    assert.match(csp!, /(^|; )connect-src 'self' blob: http:\/\/api\.test:3000(;|$)/);
    assert.match(csp!, /(^|; )frame-ancestors 'none'(;|$)/);
    assert.match(csp!, /(^|; )object-src 'none'(;|$)/);
  });

  it('keeps the policy on a redirect and on the expired screen', () => {
    assert.ok(run('/', undefined).headers.get('content-security-policy'));
    assert.ok(run('/login?expired=1', COOKIE).headers.get('content-security-policy'));
  });

  it('leaves the media routes to the headers the api sends', () => {
    assert.equal(run('/media/avatars/u1', COOKIE).headers.get('content-security-policy'), null);
    const document = '/protected-media/projects/KEY/documents/1/assets/x/raw';
    assert.equal(run(document, COOKIE).headers.get('content-security-policy'), null);
  });
});

describe('proxy with API_PROXY_TARGET', () => {
  beforeEach(() => {
    process.env.API_PROXY_TARGET = 'http://127.0.0.1:4001';
  });
  function request(path: string, headers: Record<string, string>) {
    return proxy(new NextRequest(`http://itsaplan-8.orca.localhost:60418${path}`, { headers }));
  }
  const rewrite = (res: Response) => res.headers.get('x-middleware-rewrite');

  it('passes a script fetch of an api path to the api', () => {
    const res = request('/teams?x=1', { 'sec-fetch-dest': 'empty', cookie: COOKIE });
    assert.equal(rewrite(res), 'http://127.0.0.1:4001/teams?x=1');
  });

  it('always passes the auth handler, navigations included', () => {
    const res = request('/api/auth/callback/oidc', { 'sec-fetch-dest': 'document' });
    assert.equal(rewrite(res), 'http://127.0.0.1:4001/api/auth/callback/oidc');
  });

  it('keeps page loads, RSC fetches and media on the web app', () => {
    assert.equal(
      rewrite(request('/teams', { 'sec-fetch-dest': 'document', cookie: COOKIE })),
      null,
    );
    assert.equal(
      rewrite(request('/teams', { 'sec-fetch-dest': 'empty', rsc: '1', cookie: COOKIE })),
      null,
    );
    assert.equal(rewrite(request('/media/avatars/a.png', { 'sec-fetch-dest': 'empty' })), null);
  });

  it('leaves every request to the web app without a target', () => {
    delete process.env.API_PROXY_TARGET;
    assert.equal(rewrite(request('/teams', { 'sec-fetch-dest': 'empty', cookie: COOKIE })), null);
  });
});
