import { describe, it, expect, afterEach } from 'bun:test';
import { assertPublicHost, UrlNotAllowedError } from '../index';

// The guard is strict under NODE_ENV=test, so these exercise the production rules.
describe('assertPublicHost', () => {
  it('rejects a literal private, loopback, or link-local address', async () => {
    for (const host of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '[::1]', '::ffff:10.0.0.1']) {
      await expect(assertPublicHost(host)).rejects.toBeInstanceOf(UrlNotAllowedError);
    }
  });

  it('rejects a local hostname', async () => {
    await expect(assertPublicHost('localhost')).rejects.toBeInstanceOf(UrlNotAllowedError);
    await expect(assertPublicHost('printer.local')).rejects.toBeInstanceOf(UrlNotAllowedError);
  });

  it('rejects a public hostname that resolves to a private address', async () => {
    await expect(assertPublicHost('localtest.me')).rejects.toBeInstanceOf(UrlNotAllowedError);
  });

  it('rejects a hostname that does not resolve', async () => {
    await expect(assertPublicHost('smtp.invalid')).rejects.toBeInstanceOf(UrlNotAllowedError);
  });

  it('names the field in the error', async () => {
    await expect(assertPublicHost('127.0.0.1', 'SMTP host')).rejects.toThrow(
      'SMTP host must not point to a private or local address',
    );
  });

  it('admits a public hostname', async () => {
    await expect(assertPublicHost('example.com')).resolves.toBeUndefined();
  });

  describe('SSRF_ALLOWED_HOSTS', () => {
    const saved = process.env.SSRF_ALLOWED_HOSTS;
    afterEach(() => {
      if (saved === undefined) delete process.env.SSRF_ALLOWED_HOSTS;
      else process.env.SSRF_ALLOWED_HOSTS = saved;
    });

    it('admits a named private address and a named hostname that resolves privately', async () => {
      process.env.SSRF_ALLOWED_HOSTS = '10.0.0.1, localtest.me';
      await expect(assertPublicHost('10.0.0.1')).resolves.toBeUndefined();
      await expect(assertPublicHost('localtest.me')).resolves.toBeUndefined();
    });

    it('matches the exact host only', async () => {
      process.env.SSRF_ALLOWED_HOSTS = 'localtest.me';
      await expect(assertPublicHost('sub.localtest.me')).rejects.toBeInstanceOf(UrlNotAllowedError);
    });
  });
});
