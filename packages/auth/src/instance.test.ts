import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { appSecret, db, readSecret } from '@repo/db';
import { eq } from 'drizzle-orm';
import {
  setAuthentikSettings,
  type InstanceAuthentikConfig,
  type InstanceAuthentikPatch,
} from './instance';

const AUTHENTIK_SECRET_KEY = 'auth.authentik';
const authentikCredentials = {
  discoveryUrl: 'https://auth.example.com/application/o/itsaplan/.well-known/openid-configuration',
  clientId: 'authentik-client',
  clientSecret: 'authentik-secret',
  enabled: true,
} satisfies InstanceAuthentikPatch;

async function clearAuthentikSecret() {
  await db.delete(appSecret).where(eq(appSecret.key, AUTHENTIK_SECRET_KEY));
}

describe('Authentik instance settings', () => {
  beforeEach(clearAuthentikSecret);
  afterEach(clearAuthentikSecret);

  it('encrypts and rotates the client secret', async () => {
    await setAuthentikSettings(authentikCredentials);

    const [stored] = await db
      .select({ ciphertext: appSecret.ciphertext, redacted: appSecret.redacted })
      .from(appSecret)
      .where(eq(appSecret.key, AUTHENTIK_SECRET_KEY));
    expect(stored?.ciphertext).not.toContain(authentikCredentials.clientSecret);
    expect(stored?.redacted).toMatchObject({ hasClientSecret: true });

    await setAuthentikSettings({ clientSecret: 'rotated-secret' });

    const decrypted = await readSecret<InstanceAuthentikConfig>(AUTHENTIK_SECRET_KEY);
    expect(decrypted?.clientSecret).toBe('rotated-secret');
  });
});
