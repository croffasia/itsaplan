import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { GET } from './route';

const originalFetch = globalThis.fetch;
const originalOrigin = process.env.SERVICE_URL_API;
const params = Promise.resolve({
  projectKey: 'SEKTA',
  documentId: '42',
  publicId: '123e4567-e89b-42d3-a456-426614174000',
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalOrigin === undefined) delete process.env.SERVICE_URL_API;
  else process.env.SERVICE_URL_API = originalOrigin;
});

describe('protected document asset proxy', () => {
  it('requires a session cookie before contacting the API', async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response();
    }) as typeof fetch;
    const response = await GET(new Request('https://plan.test/protected-media/example'), {
      params,
    });
    assert.equal(response.status, 401);
    assert.equal(called, false);
  });

  it('forwards only the session and cache validator to the exact asset endpoint', async () => {
    process.env.SERVICE_URL_API = 'http://api:3000';
    let capturedInput = '';
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      capturedInput = String(input);
      capturedInit = init;
      return new Response('image', {
        headers: { 'content-type': 'image/png', etag: 'asset-v1', 'x-private': 'drop-me' },
      });
    }) as typeof fetch;
    const response = await GET(
      new Request('https://plan.test/protected-media/example', {
        headers: { cookie: 'session=value', 'if-none-match': 'asset-v0', authorization: 'drop-me' },
      }),
      { params },
    );
    assert.equal(
      capturedInput,
      'http://api:3000/projects/SEKTA/documents/42/assets/123e4567-e89b-42d3-a456-426614174000/raw',
    );
    assert.deepEqual(capturedInit?.headers, {
      cookie: 'session=value',
      'if-none-match': 'asset-v0',
    });
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('x-private'), null);
  });
});
