import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

describe('link previews', () => {
  beforeEach(resetDb);

  it('refuses invalid, credential-bearing and private URLs for authenticated users', async () => {
    const { cookie } = await signUpTestUser();
    const client = authedApi(cookie);
    for (const url of [
      'not a URL',
      'file:///etc/passwd',
      'https://user:secret@example.com',
      'https://user@example.com',
      'http://127.0.0.1',
      'http://127.0.0.1#cached-fragment',
      'http://2130706433',
      'http://[::ffff:127.0.0.1]',
      'http://localhost',
      'https://169.254.169.254',
      'http://100.64.0.1',
      'https://192.0.2.1',
    ]) {
      const result = await client['link-previews'].get({ query: { url } });
      expect(result.status).toBe(400);
    }
  });

  it('bounds the URL query before attempting an outbound request', async () => {
    const { cookie } = await signUpTestUser();
    const client = authedApi(cookie);
    for (const url of ['', `https://example.com/${'x'.repeat(4096)}`]) {
      const result = await client['link-previews'].get({ query: { url } });
      expect(result.status).toBe(400);
    }
  });
});
