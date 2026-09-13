import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

const COOKIE = 'better-auth.session_token=stale.signature';

let originalApiUrl: string | undefined;

beforeEach(() => {
  originalApiUrl = process.env.API_URL;
});

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.API_URL;
  else process.env.API_URL = originalApiUrl;
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

  it('sends a visitor without a session to the login page', () => {
    const res = run('/', undefined);
    assert.equal(res.headers.get('location'), 'http://localhost/login');
  });
});

describe('proxy security headers', () => {
  it('serves every page with a content security policy naming the api origin', () => {
    process.env.API_URL = 'http://api.test:3000/';
    const csp = run('/login').headers.get('content-security-policy');
    assert.match(csp!, /(^|; )connect-src 'self' http:\/\/api\.test:3000(;|$)/);
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
