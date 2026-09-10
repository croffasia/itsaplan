import { describe, it, expect, afterEach } from 'bun:test';
import { checkHttpUrl, isPrivateIp, UrlNotAllowedError } from '../index';

// The synchronous subset of the guard, for a URL stored now and fetched later. Strict
// under NODE_ENV=test, which bun test sets.
describe('checkHttpUrl', () => {
  const saved = process.env.SSRF_ALLOWED_HOSTS;
  afterEach(() => {
    if (saved === undefined) delete process.env.SSRF_ALLOWED_HOSTS;
    else process.env.SSRF_ALLOWED_HOSTS = saved;
  });

  it('returns the parsed URL of a public https host without resolving it', () => {
    expect(checkHttpUrl('https://does-not-resolve.invalid/x').hostname).toBe(
      'does-not-resolve.invalid',
    );
  });

  it('rejects an unparsable value, a non-https scheme, and a private or local literal', () => {
    for (const raw of [
      'example.com',
      'http://example.com/',
      'https://127.0.0.1/',
      'https://localhost/',
      'https://[::ffff:169.254.169.254]/',
      'https://169.254.169.254/latest/meta-data/',
    ]) {
      expect(() => checkHttpUrl(raw)).toThrow(UrlNotAllowedError);
    }
  });

  it('admits a private literal that SSRF_ALLOWED_HOSTS names, over http as well', () => {
    process.env.SSRF_ALLOWED_HOSTS = '10.1.2.3';
    expect(checkHttpUrl('https://10.1.2.3/').hostname).toBe('10.1.2.3');
    expect(checkHttpUrl('http://10.1.2.3:11434/v1').port).toBe('11434');
    expect(() => checkHttpUrl('http://10.9.9.9/')).toThrow(UrlNotAllowedError);
  });
});

describe('isPrivateIp', () => {
  it('flags loopback, private, link-local, and CGNAT IPv4', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '192.168.0.10',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
    ]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it('passes public IPv4', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1']) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });

  it('flags loopback, link-local, and unique-local IPv6', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fd00::1', 'FD00::1']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it('flags IPv4-mapped and IPv4-compatible IPv6 carrying a private IPv4', () => {
    for (const ip of [
      '::ffff:127.0.0.1',
      '::ffff:169.254.169.254',
      '::ffff:7f00:1',
      '::ffff:a9fe:a9fe',
      '::FFFF:A9FE:A9FE',
      '::127.0.0.1',
    ]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it('passes IPv4-mapped IPv6 carrying a public IPv4', () => {
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
    expect(isPrivateIp('::ffff:808:808')).toBe(false);
  });
});
