import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';
import { forgetEmbedSites } from './utils/embedSites';

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
  it('keeps a stale session on the expired screen instead of bouncing it back', async () => {
    const res = await run('/login?expired=1', COOKIE);
    assert.equal(res.headers.get('location'), null);
  });

  it('expires the stale cookies the api could not clear', async () => {
    const res = await run(
      '/login?expired=1',
      `${COOKIE}; __Secure-better-auth.session_data=cached`,
    );
    const cleared = res.headers.getSetCookie();
    assert.equal(cleared.length, 2);
    assert.match(cleared[0]!, /^better-auth\.session_token=;/);
    assert.match(cleared[0]!, /Expires=Thu, 01 Jan 1970/);
    // A `__Secure-` cookie is only accepted back with the attribute its name demands.
    assert.match(cleared[1]!, /^__Secure-better-auth\.session_data=;/);
    assert.match(cleared[1]!, /Secure/);
  });

  it('sends a signed-in user away from the login page', async () => {
    const res = await run('/login', COOKIE);
    assert.equal(res.headers.get('location'), 'http://localhost/');
  });

  it('leaves a signed-in user on the login page when it carries an error', async () => {
    const res = await run('/login?error=invalid_client', COOKIE);
    assert.equal(res.headers.get('location'), null);
  });

  // Over HTTPS the api names the session cookie with the __Host- prefix.
  it('treats a __Host- session cookie as a session', async () => {
    const res = await run('/login', '__Host-better-auth.session_token=value');
    assert.equal(res.headers.get('location'), 'http://localhost/');
  });

  it('expires a __Host- cookie only at Path=/, with Secure and no Domain', async () => {
    const res = await run('/login?expired=1', '__Host-better-auth.session_token=stale');
    const cleared = res.headers.getSetCookie();
    assert.equal(cleared.length, 1);
    assert.match(cleared[0]!, /^__Host-better-auth\.session_token=; Path=\/; Expires/);
    assert.match(cleared[0]!, /Secure/);
    assert.ok(!cleared[0]!.includes('Domain='));
  });

  it('sends a visitor without a session to the login page', async () => {
    const res = await run('/', undefined);
    assert.equal(res.headers.get('location'), 'http://localhost/login');
  });
});

describe('proxy security headers', () => {
  it('serves every page with a content security policy naming the api origin', async () => {
    process.env.API_URL = 'http://api.test:3000/';
    const csp = (await run('/login')).headers.get('content-security-policy');
    assert.match(csp!, /(^|; )connect-src 'self' blob: http:\/\/api\.test:3000(;|$)/);
    assert.match(csp!, /(^|; )frame-ancestors 'none'(;|$)/);
    assert.match(csp!, /(^|; )object-src 'none'(;|$)/);
  });

  it('keeps the policy on a redirect and on the expired screen', async () => {
    assert.ok((await run('/', undefined)).headers.get('content-security-policy'));
    assert.ok((await run('/login?expired=1', COOKIE)).headers.get('content-security-policy'));
  });

  it('leaves the media routes to the headers the api sends', async () => {
    assert.equal(
      (await run('/media/avatars/u1', COOKIE)).headers.get('content-security-policy'),
      null,
    );
    const document = '/protected-media/projects/KEY/documents/1/assets/x/raw';
    assert.equal((await run(document, COOKIE)).headers.get('content-security-policy'), null);
  });
});

describe('proxy frames', () => {
  const realFetch = globalThis.fetch;
  let asked: string[] = [];

  // The api answers `GET /embed-sites` with these sites, or not at all.
  function api(origins: string[] | null) {
    globalThis.fetch = (async (url: string) => {
      asked.push(String(url));
      if (!origins) throw new Error('unreachable');
      return Response.json({ origins });
    }) as typeof fetch;
  }

  const ancestors = (res: Response) =>
    /frame-ancestors ([^;]+)/.exec(res.headers.get('content-security-policy')!)![1];

  beforeEach(() => {
    process.env.API_URL = 'http://api.test:3000';
    asked = [];
    forgetEmbedSites();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.SERVICE_URL_API;
  });

  it('lets the trusted sites frame a share page and a public page', async () => {
    api(['https://acme.com', 'http://localhost:5055']);
    for (const path of ['/share/abc', '/p/forms/support']) {
      const res = await run(path);
      assert.equal(ancestors(res), "'self' https://acme.com http://localhost:5055");
      assert.equal(res.headers.get('x-frame-options'), null);
    }
    assert.deepEqual(asked, ['http://api.test:3000/embed-sites']);
  });

  it("reads the sites at the api's address inside the deployment when it has one", async () => {
    process.env.SERVICE_URL_API = 'http://api:3000';
    api(['https://acme.com']);
    await run('/share/abc');
    assert.deepEqual(asked, ['http://api:3000/embed-sites']);
  });

  it('lets only the app frame a public page while no site is trusted or the api does not answer', async () => {
    api([]);
    const res = await run('/share/abc');
    assert.equal(ancestors(res), "'self'");
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');

    forgetEmbedSites();
    api(null);
    assert.equal(ancestors(await run('/p/forms/support')), "'self'");
  });

  it('never frames another page, nor asks the api for one', async () => {
    api(['https://acme.com']);
    assert.equal(ancestors(await run('/login')), "'none'");
    assert.equal(ancestors(await run('/projects', COOKIE)), "'none'");
    assert.deepEqual(asked, []);
  });
});
