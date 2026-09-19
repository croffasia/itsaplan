import { describe, it, expect, afterEach } from 'bun:test';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import { assertPublicHttpUrl, pinnedFetch, UrlNotAllowedError } from '../index';

// The guard is strict under NODE_ENV=test, so these exercise the production rules.
describe('pinnedFetch', () => {
  it('rejects a literal private address', async () => {
    await expect(pinnedFetch('https://127.0.0.1/')).rejects.toBeInstanceOf(UrlNotAllowedError);
    await expect(pinnedFetch('https://[::ffff:169.254.169.254]/')).rejects.toBeInstanceOf(
      UrlNotAllowedError,
    );
  });

  it('rejects a public hostname that resolves to a private address', async () => {
    await expect(pinnedFetch('https://localtest.me/')).rejects.toBeInstanceOf(UrlNotAllowedError);
  });

  it('rejects a non-https url', async () => {
    await expect(pinnedFetch('http://example.com/')).rejects.toBeInstanceOf(UrlNotAllowedError);
  });

  it('reaches a public host, with TLS still verified against the hostname', async () => {
    const res = await pinnedFetch('https://example.com/', { timeoutMs: 15_000 });
    expect(res.status).toBe(200);
    expect((await res.text()).length).toBeGreaterThan(0);
  });
});

// SSRF_ALLOWED_HOSTS is the operator's escape hatch for a self-hosted repository
// host: its address is configuration rather than content, and on a self-hosted
// instance it is normally private. These run under NODE_ENV=test, so the strict
// rules apply and the allowlist is the only thing admitting the URL.
describe('SSRF_ALLOWED_HOSTS', () => {
  const saved = process.env.SSRF_ALLOWED_HOSTS;
  afterEach(() => {
    if (saved === undefined) delete process.env.SSRF_ALLOWED_HOSTS;
    else process.env.SSRF_ALLOWED_HOSTS = saved;
  });

  it('admits a literal private address that is named', async () => {
    delete process.env.SSRF_ALLOWED_HOSTS;
    await expect(assertPublicHttpUrl('https://127.0.0.1/')).rejects.toBeInstanceOf(
      UrlNotAllowedError,
    );
    process.env.SSRF_ALLOWED_HOSTS = '127.0.0.1';
    expect((await assertPublicHttpUrl('https://127.0.0.1/')).hostname).toBe('127.0.0.1');
  });

  it('admits a public hostname that resolves privately when it is named', async () => {
    process.env.SSRF_ALLOWED_HOSTS = 'localtest.me';
    expect((await assertPublicHttpUrl('https://localtest.me/')).hostname).toBe('localtest.me');
  });

  it('reads a comma-separated list, ignoring spacing and case', async () => {
    process.env.SSRF_ALLOWED_HOSTS = ' git.example.com , LOCALTEST.ME ';
    expect((await assertPublicHttpUrl('https://localtest.me/')).hostname).toBe('localtest.me');
  });

  it('matches the exact host only — no suffix or wildcard matching', async () => {
    process.env.SSRF_ALLOWED_HOSTS = 'localtest.me';
    await expect(assertPublicHttpUrl('https://sub.localtest.me/')).rejects.toBeInstanceOf(
      UrlNotAllowedError,
    );
  });

  it('admits http to a named host, and no other scheme', async () => {
    process.env.SSRF_ALLOWED_HOSTS = 'localtest.me';
    expect((await assertPublicHttpUrl('http://localtest.me/')).protocol).toBe('http:');
    await expect(assertPublicHttpUrl('ftp://localtest.me/')).rejects.toBeInstanceOf(
      UrlNotAllowedError,
    );
  });

  it('keeps http off a host that is not named', async () => {
    process.env.SSRF_ALLOWED_HOSTS = 'git.example.com';
    await expect(assertPublicHttpUrl('http://localtest.me/')).rejects.toBeInstanceOf(
      UrlNotAllowedError,
    );
  });

  it('exempts nothing when unset', async () => {
    delete process.env.SSRF_ALLOWED_HOSTS;
    await expect(assertPublicHttpUrl('https://localtest.me/')).rejects.toBeInstanceOf(
      UrlNotAllowedError,
    );
  });
});

// node sends no User-Agent of its own, unlike the fetch this replaced, and GitHub
// answers 403 to a request without one. The requests go to a loopback server, which
// the guard admits only outside production and test, so NODE_ENV is relaxed around
// them and restored afterwards.
describe('pinnedFetch User-Agent', () => {
  const saved = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = saved;
  });

  async function headersSeenBy(init?: { headers: Record<string, string> }) {
    let seen: IncomingHttpHeaders = {};
    const server = createServer((req, res) => {
      seen = req.headers;
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    process.env.NODE_ENV = 'development';
    try {
      await pinnedFetch(`http://127.0.0.1:${port}/`, init);
    } finally {
      process.env.NODE_ENV = saved;
      server.close();
    }
    return seen;
  }

  it('sends a default User-Agent when the caller set none', async () => {
    expect((await headersSeenBy())['user-agent']).toBe('itsaplan/1');
  });

  it("keeps the caller's own User-Agent", async () => {
    const headers = await headersSeenBy({ headers: { 'User-Agent': 'itsaplan-webhooks/1' } });
    expect(headers['user-agent']).toBe('itsaplan-webhooks/1');
  });
});
