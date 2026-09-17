import { afterEach, describe, expect, it } from 'bun:test';
import { createServer, type RequestListener } from 'node:http';
import { assertPublicHttpUrl, pinnedFetch, UrlNotAllowedError } from '../index';

describe('public-only URL policy', () => {
  const environment = process.env.NODE_ENV;
  const allowedHosts = process.env.SSRF_ALLOWED_HOSTS;
  afterEach(() => {
    process.env.NODE_ENV = environment;
    if (allowedHosts === undefined) delete process.env.SSRF_ALLOWED_HOSTS;
    else process.env.SSRF_ALLOWED_HOSTS = allowedHosts;
  });

  it('rejects private, reserved and local addresses even in development with an allowlist', async () => {
    process.env.NODE_ENV = 'development';
    process.env.SSRF_ALLOWED_HOSTS = '127.0.0.1,localhost';
    for (const host of [
      '127.0.0.1',
      'localhost',
      '10.0.0.1',
      '169.254.169.254',
      '224.0.0.1',
      '255.255.255.255',
      '[::1]',
      '[fe90::1]',
      '[fea0::1]',
      '[feb0::1]',
      '[::ffff:127.0.0.1]',
      '[2001:db8::1]',
      '[2002:7f00:1::]',
    ]) {
      await expect(
        assertPublicHttpUrl(`http://${host}/`, { publicOnly: true }),
      ).rejects.toBeInstanceOf(UrlNotAllowedError);
    }
  });

  it('rejects credentials and non-HTTP schemes', async () => {
    for (const url of [
      'https://user:secret@example.com/',
      'file:///etc/passwd',
      'javascript:alert(1)',
    ]) {
      await expect(assertPublicHttpUrl(url, { publicOnly: true })).rejects.toBeInstanceOf(
        UrlNotAllowedError,
      );
    }
  });

  it('refuses a hostname resolving privately despite its allowlist entry', async () => {
    process.env.NODE_ENV = 'development';
    process.env.SSRF_ALLOWED_HOSTS = 'localtest.me';
    await expect(
      assertPublicHttpUrl('https://localtest.me/', { publicOnly: true }),
    ).rejects.toBeInstanceOf(UrlNotAllowedError);
  });

  it('honors an already aborted signal before DNS or HTTP', async () => {
    await expect(
      pinnedFetch('https://example.com', { publicOnly: true, signal: AbortSignal.abort() }),
    ).rejects.toBeDefined();
  });
});

describe('bounded pinned fetch', () => {
  const environment = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = environment;
  });

  async function withServer(handler: RequestListener, run: (url: string) => Promise<void>) {
    const server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test port');
    process.env.NODE_ENV = 'development';
    try {
      await run(`http://127.0.0.1:${address.port}`);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  it('accepts exactly the byte limit and rejects a larger response', async () => {
    await withServer(
      (_req, res) => res.end('12345'),
      async (url) => {
        expect(await (await pinnedFetch(url, { maxBytes: 5 })).text()).toBe('12345');
        await expect(pinnedFetch(url, { maxBytes: 4 })).rejects.toThrow('byte limit');
      },
    );
  });

  it('aborts a response that keeps sending bytes before its inactivity timeout', async () => {
    await withServer(
      (_req, res) => {
        const timer = setInterval(() => res.write('x'), 10);
        res.on('close', () => clearInterval(timer));
      },
      async (url) => {
        await expect(
          pinnedFetch(url, { timeoutMs: 500, signal: AbortSignal.timeout(80) }),
        ).rejects.toThrow('aborted');
      },
    );
  });

  it('returns only the bounded prefix when requested for document metadata', async () => {
    await withServer(
      (_req, res) => res.end('123456789'),
      async (url) => {
        expect(await (await pinnedFetch(url, { maxBytes: 5, truncateBody: true })).text()).toBe(
          '12345',
        );
      },
    );
  });

  it('returns a redirect without following its target', async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(302, { Location: 'http://169.254.169.254/' });
        res.end();
      },
      async (url) => {
        expect((await pinnedFetch(url, { maxBytes: 512 })).status).toBe(302);
      },
    );
  });

  it('rejects invalid upstream status codes without leaving the request pending', async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(600);
        res.end();
      },
      async (url) => {
        await expect(pinnedFetch(url, { signal: AbortSignal.timeout(100) })).rejects.toThrow(
          'invalid HTTP status',
        );
      },
    );
  });
});
