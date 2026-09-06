import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

const COOKIE = 'better-auth.session_token=stale.signature';

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
