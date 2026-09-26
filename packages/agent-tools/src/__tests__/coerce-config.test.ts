import { describe, it, expect, afterEach } from 'bun:test';
import { coerceConfig, ToolConfigError } from '../index';
import type { ConfigField } from '../index';

const fields: ConfigField[] = [
  { key: 'baseUrl', label: 'Instance URL', type: 'url', required: true },
  { key: 'token', label: 'Access token', type: 'secret', required: true },
];

const withUrl = (baseUrl: string) => coerceConfig(fields, { baseUrl, token: 't' });

// bun test sets NODE_ENV=test, so the strict rules apply: https only, no private or
// local host unless SSRF_ALLOWED_HOSTS names it.
describe('coerceConfig url field', () => {
  const saved = process.env.SSRF_ALLOWED_HOSTS;
  afterEach(() => {
    if (saved === undefined) delete process.env.SSRF_ALLOWED_HOSTS;
    else process.env.SSRF_ALLOWED_HOSTS = saved;
  });

  it('keeps origin and path, dropping a trailing slash', () => {
    expect(withUrl('https://git.example.com/').baseUrl).toBe('https://git.example.com');
    expect(withUrl(' https://Git.Example.com:8443/gitea/ ').baseUrl).toBe(
      'https://git.example.com:8443/gitea',
    );
    expect(withUrl('https://llm.example.com/v1').baseUrl).toBe('https://llm.example.com/v1');
  });

  it('rejects a value that is not a URL', () => {
    expect(() => withUrl('git.example.com')).toThrow(ToolConfigError);
    expect(() => withUrl('not a url')).toThrow('Instance URL must be a valid URL');
  });

  it('rejects a non-https scheme', () => {
    expect(() => withUrl('http://git.example.com')).toThrow('Instance URL must use https');
    expect(() => withUrl('ftp://git.example.com')).toThrow(ToolConfigError);
    expect(() => withUrl('file:///etc/passwd')).toThrow(ToolConfigError);
  });

  it('rejects a private, loopback, or link-local literal address', () => {
    for (const raw of [
      'https://127.0.0.1',
      'https://10.0.0.5/gitea',
      'https://192.168.1.10',
      'https://localhost:3000',
      'https://[::1]',
      'https://[::ffff:169.254.169.254]',
    ]) {
      expect(() => withUrl(raw)).toThrow('must not point to a private or local address');
    }
  });

  it('refuses the cloud metadata service', () => {
    expect(() => withUrl('http://169.254.169.254/latest/meta-data/')).toThrow(ToolConfigError);
    expect(() => withUrl('https://169.254.169.254/latest/meta-data/')).toThrow(ToolConfigError);
  });

  it('rejects userinfo, a query string, and a fragment', () => {
    for (const raw of [
      'https://user:pw@git.example.com',
      'https://git.example.com/?next=1',
      'https://git.example.com/#frag',
    ]) {
      expect(() => withUrl(raw)).toThrow(
        'must not carry credentials, a query string, or a fragment',
      );
    }
  });

  // A self-hosted model server is the case this exists for: it listens on a private
  // address, over http, on a port of its own.
  it('admits a private address that SSRF_ALLOWED_HOSTS names, over http as well', () => {
    process.env.SSRF_ALLOWED_HOSTS = '10.0.0.5,ollama';
    expect(withUrl('https://10.0.0.5/gitea').baseUrl).toBe('https://10.0.0.5/gitea');
    expect(withUrl('http://ollama:11434/v1').baseUrl).toBe('http://ollama:11434/v1');
    expect(() => withUrl('http://10.0.0.6/gitea')).toThrow(ToolConfigError);
  });

  it('still requires the field when it is required', () => {
    expect(() => coerceConfig(fields, { token: 't' })).toThrow('Missing required setting');
  });
});
