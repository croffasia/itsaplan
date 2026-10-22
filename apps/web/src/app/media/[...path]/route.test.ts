import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { GET } from './route';

const PUBLIC_ID = '123e4567-e89b-42d3-a456-426614174000';
const originalFetch = globalThis.fetch;
const originalOrigin = process.env.SERVICE_URL_API;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalOrigin === undefined) delete process.env.SERVICE_URL_API;
  else process.env.SERVICE_URL_API = originalOrigin;
});

function get(path: string[]) {
  return GET(new Request('https://plan.test/media/example'), { params: Promise.resolve({ path }) });
}

describe('public media proxy', () => {
  it('answers 404 without contacting the API for a path of another shape', async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response();
    }) as typeof fetch;
    for (const path of [
      ['docs', PUBLIC_ID, 'raw'],
      ['avatars', 'not-an-id', 'raw'],
      ['avatars', PUBLIC_ID],
      ['avatars', PUBLIC_ID, 'meta'],
      ['avatars', PUBLIC_ID, 'raw', 'extra'],
    ]) {
      const response = await get(path);
      assert.equal(response.status, 404, path.join('/'));
    }
    assert.equal(called, false);
  });

  it('rejects encoded traversal before contacting the API', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response();
    }) as typeof fetch;
    for (const root of ['avatars', 'attachments', 'chat-attachments', 'initiative-attachments']) {
      for (const segment of ['%252e%252e', '%2e%2e', '.%2e', '%252E%252E', '%2f', '%252f', '%5c']) {
        // Next decodes each catch-all segment once before passing it to the handler.
        const path = [root, decodeURIComponent(segment), 'docs', 'json'];
        assert.equal((await get(path)).status, 404, path.join('/'));
        const mediaPath = [root, decodeURIComponent(segment), 'raw'];
        assert.equal((await get(mediaPath)).status, 404, mediaPath.join('/'));
      }
    }
    assert.equal(calls, 0);
  });

  it('serves files from every public media root', async () => {
    process.env.SERVICE_URL_API = 'http://api:3000';
    const targets: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      targets.push(String(input));
      return new Response('media');
    }) as typeof fetch;
    const roots = ['avatars', 'attachments', 'chat-attachments', 'initiative-attachments'];
    for (const root of roots) {
      const response = await get([root, PUBLIC_ID, 'raw']);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'media');
    }
    assert.deepEqual(
      targets,
      roots.map((root) => 'http://api:3000/' + root + '/' + PUBLIC_ID + '/raw'),
    );
  });

  it('streams the exact media endpoint with the query and the cache validator', async () => {
    process.env.SERVICE_URL_API = 'http://api:3000';
    let capturedInput = '';
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      capturedInput = String(input);
      capturedInit = init;
      return new Response('image', {
        headers: { 'content-type': 'image/png', 'x-private': 'drop-me' },
      });
    }) as typeof fetch;
    const response = await GET(
      new Request('https://plan.test/media/example?download=1', {
        headers: { cookie: 'session=value', 'if-none-match': 'v0' },
      }),
      { params: Promise.resolve({ path: ['attachments', PUBLIC_ID, 'raw'] }) },
    );
    assert.equal(capturedInput, `http://api:3000/attachments/${PUBLIC_ID}/raw?download=1`);
    assert.deepEqual(capturedInit?.headers, { 'if-none-match': 'v0' });
    assert.equal(capturedInit?.redirect, 'error');
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('x-private'), null);
  });
});
