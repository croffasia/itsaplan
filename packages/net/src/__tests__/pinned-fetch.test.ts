import { describe, it, expect } from 'bun:test';
import { pinnedFetch, UrlNotAllowedError } from '../index';

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
