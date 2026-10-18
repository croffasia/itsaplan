import { describe, expect, test } from 'bun:test';
import {
  createSharePointDriver,
  SIMPLE_UPLOAD_MAX,
  UPLOAD_CHUNK_SIZE,
  type SharePointConfig,
} from '../sharepoint';

type Call = { url: string; init: RequestInit; headers: Headers };

function setup(
  handler: (call: Call, calls: Call[]) => Response | Promise<Response>,
  config: Partial<SharePointConfig> = {},
) {
  const calls: Call[] = [];
  const sleeps: number[] = [];
  let clock = 1_000_000;
  const fakeFetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(input), init, headers: new Headers(init.headers) };
    calls.push(call);
    if (call.url.includes('login.microsoftonline.com')) {
      return Response.json({ access_token: `tok${calls.length}`, expires_in: 3600 });
    }
    return handler(call, calls);
  }) as typeof fetch;
  const driver = createSharePointDriver(
    { tenantId: 't1', clientId: 'c', clientSecret: 's', driveId: 'd1', ...config },
    {
      fetch: fakeFetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      now: () => clock,
    },
  );
  return {
    driver,
    calls,
    sleeps,
    advance: (ms: number) => {
      clock += ms;
    },
    graph: () => calls.filter((c) => c.url.startsWith('https://graph.microsoft.com')),
    tokens: () => calls.filter((c) => c.url.includes('login.microsoftonline.com')),
  };
}

describe('sharepoint driver', () => {
  test('requests a client-credentials token and caches it until shortly before expiry', async () => {
    const t = setup(() => new Response(null, { status: 200 }));
    await t.driver.put('a/b.txt', Buffer.from('x'), 'text/plain');
    await t.driver.put('a/c.txt', Buffer.from('x'), 'text/plain');
    expect(t.tokens()).toHaveLength(1);
    const tokenCall = t.tokens()[0]!;
    expect(tokenCall.url).toBe('https://login.microsoftonline.com/t1/oauth2/v2.0/token');
    const form = new URLSearchParams(String(tokenCall.init.body));
    expect(form.get('grant_type')).toBe('client_credentials');
    expect(form.get('scope')).toBe('https://graph.microsoft.com/.default');
    expect(t.graph()[0]!.headers.get('Authorization')).toBe('Bearer tok1');

    t.advance(3600 * 1000 - 30_000);
    await t.driver.put('a/d.txt', Buffer.from('x'), 'text/plain');
    expect(t.tokens()).toHaveLength(2);
  });

  test('encodes each key segment under the root folder and rejects bad segments', async () => {
    const t = setup(() => new Response(null, { status: 200 }), { rootFolder: 'my root' });
    await t.driver.put('projects/1/a b#c.png', Buffer.from('x'), 'image/png');
    expect(t.graph()[0]!.url).toStartWith(
      'https://graph.microsoft.com/v1.0/drives/d1/root:/my%20root/projects/1/a%20b%23c.png:/content',
    );
    for (const key of ['../x', 'a/../b', 'a//b', '/a', 'a/', 'a/./b', 'a\\b', '']) {
      await expect(t.driver.put(key, Buffer.from('x'), 'text/plain')).rejects.toThrow(
        /Invalid object key/,
      );
    }
    expect(t.graph()).toHaveLength(1);
  });

  test('defaults the root folder to itsaplan', async () => {
    const t = setup(() => new Response(null, { status: 200 }));
    await t.driver.put('k.txt', Buffer.from('x'), 'text/plain');
    expect(t.graph()[0]!.url).toContain('/root:/itsaplan/k.txt:/content');
  });

  test('resolves the default drive of a site once', async () => {
    const t = setup(
      (call) =>
        call.url.includes('/sites/')
          ? Response.json({ id: 'drive-from-site' })
          : new Response(null, { status: 200 }),
      { driveId: undefined, siteId: 'host,abc,def' },
    );
    await t.driver.put('a.txt', Buffer.from('x'), 'text/plain');
    await t.driver.put('b.txt', Buffer.from('x'), 'text/plain');
    expect(t.graph()[0]!.url).toStartWith(
      'https://graph.microsoft.com/v1.0/sites/host%2Cabc%2Cdef/drive',
    );
    expect(t.graph().filter((c) => c.url.includes('/sites/'))).toHaveLength(1);
    expect(t.graph()[1]!.url).toContain('/drives/drive-from-site/');
  });

  test('uploads small bodies with one PUT', async () => {
    const t = setup(() => new Response(null, { status: 201 }));
    await t.driver.put('a.bin', Buffer.alloc(SIMPLE_UPLOAD_MAX), 'application/octet-stream');
    expect(t.graph()).toHaveLength(1);
    expect(t.graph()[0]!.init.method).toBe('PUT');
  });

  test('uploads large bodies through an upload session in 320 KiB multiples', async () => {
    expect(UPLOAD_CHUNK_SIZE % (320 * 1024)).toBe(0);
    const size = UPLOAD_CHUNK_SIZE * 2 + 5;
    const t = setup((call) => {
      if (call.url.endsWith(':/createUploadSession')) {
        return Response.json({ uploadUrl: 'https://upload.example.net/session/1' });
      }
      const range = call.headers.get('Content-Range')!;
      return new Response(null, { status: range.endsWith(`-${size - 1}/${size}`) ? 201 : 202 });
    });
    await t.driver.put('big.bin', Buffer.alloc(size), 'application/octet-stream');
    const chunks = t.calls.filter((c) => c.url.startsWith('https://upload.example.net'));
    expect(chunks.map((c) => c.headers.get('Content-Range'))).toEqual([
      `bytes 0-${UPLOAD_CHUNK_SIZE - 1}/${size}`,
      `bytes ${UPLOAD_CHUNK_SIZE}-${UPLOAD_CHUNK_SIZE * 2 - 1}/${size}`,
      `bytes ${UPLOAD_CHUNK_SIZE * 2}-${size - 1}/${size}`,
    ]);
    // The session URL is pre-authenticated: no bearer.
    expect(chunks.every((c) => !c.headers.has('Authorization'))).toBe(true);
    expect(t.graph().some((c) => c.url.includes(':/createUploadSession'))).toBe(true);
  });

  test('download follows the redirect without sending the bearer to the other host', async () => {
    const t = setup((call) => {
      if (call.url.startsWith('https://graph.microsoft.com')) {
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://contoso.sharepoint.com/dl?tempauth=x' },
        });
      }
      return new Response('hello', { status: 200, headers: { 'Content-Length': '5' } });
    });
    const obj = await t.driver.get('projects/1/attachments/1/u-note.txt');
    expect(await new Response(obj.body).text()).toBe('hello');
    expect(obj.contentType).toBe('text/plain');
    expect(obj.contentLength).toBe(5);
    const download = t.calls.find((c) => c.url.startsWith('https://contoso.sharepoint.com'))!;
    expect(download.headers.has('Authorization')).toBe(false);
    expect(t.graph()[0]!.init.redirect).toBe('manual');
    expect(t.graph()[0]!.headers.get('Authorization')).toStartWith('Bearer ');
  });

  test('sniffs the content type of extensionless keys (avatars)', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const t = setup(() => new Response(png, { status: 200 }));
    const obj = await t.driver.get('avatars/abc');
    expect(obj.contentType).toBe('image/png');
    expect(new Uint8Array(await new Response(obj.body).arrayBuffer())).toEqual(png);
  });

  test('a missing object rejects on get and is success on delete', async () => {
    const t = setup(() => new Response('{}', { status: 404 }));
    await expect(t.driver.get('x/y.txt')).rejects.toThrow(/not found/);
    await t.driver.delete('x/y.txt');
    expect(t.graph().at(-1)!.init.method).toBe('DELETE');
  });

  test('a failed delete throws', async () => {
    const t = setup(() => new Response('nope', { status: 403 }));
    await expect(t.driver.delete('x/y.txt')).rejects.toThrow(/403/);
  });

  test('retries 429 honouring Retry-After, then 503 with backoff, and gives up', async () => {
    let n = 0;
    const t = setup(() => {
      n++;
      if (n === 1) return new Response(null, { status: 429, headers: { 'Retry-After': '3' } });
      return new Response(null, { status: 204 });
    });
    await t.driver.delete('a.txt');
    expect(t.sleeps).toEqual([3000]);

    const always = setup(() => new Response('busy', { status: 503 }));
    await expect(always.driver.delete('a.txt')).rejects.toThrow(/503/);
    expect(always.graph()).toHaveLength(5);
    expect(always.sleeps.every((ms) => ms <= 30_000)).toBe(true);
  });

  test('caps an excessive Retry-After', async () => {
    let n = 0;
    const t = setup(() =>
      n++ === 0
        ? new Response(null, { status: 429, headers: { 'Retry-After': '9999' } })
        : new Response(null, { status: 204 }),
    );
    await t.driver.delete('a.txt');
    expect(t.sleeps).toEqual([30_000]);
  });

  test('refreshes the token once on 401', async () => {
    let n = 0;
    const t = setup(() => new Response(null, { status: n++ === 0 ? 401 : 204 }));
    await t.driver.delete('a.txt');
    expect(t.tokens()).toHaveLength(2);
  });
});
