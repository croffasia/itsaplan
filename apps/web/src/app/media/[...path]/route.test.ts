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
