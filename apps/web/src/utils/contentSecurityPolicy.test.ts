import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { contentSecurityPolicy } from './contentSecurityPolicy';

let originalApiUrl: string | undefined;
let originalProxyTarget: string | undefined;

// A local apps/web/.env may set API_PROXY_TARGET; each test starts without it.
beforeEach(() => {
  originalApiUrl = process.env.API_URL;
  originalProxyTarget = process.env.API_PROXY_TARGET;
  delete process.env.API_PROXY_TARGET;
});

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.API_URL;
  else process.env.API_URL = originalApiUrl;
  if (originalProxyTarget === undefined) delete process.env.API_PROXY_TARGET;
  else process.env.API_PROXY_TARGET = originalProxyTarget;
});

describe('contentSecurityPolicy', () => {
  it('allows requests to the api origin only, without its path', () => {
    process.env.API_URL = 'https://api.example.com/base/';
    assert.match(contentSecurityPolicy(), /connect-src 'self' blob: https:\/\/api\.example\.com;/);
  });

  it('falls back to same-origin requests when the api url is not absolute', () => {
    process.env.API_URL = 'not a url';
    assert.match(contentSecurityPolicy(), /connect-src 'self' blob:;/);
  });

  it('allows only this origin when the api is served through it', () => {
    process.env.API_URL = 'https://api.example.com';
    process.env.API_PROXY_TARGET = 'http://api:3000';
    assert.match(contentSecurityPolicy(), /connect-src 'self' blob:;/);
  });
});
