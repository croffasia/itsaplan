import { describe, expect, it, beforeEach } from 'bun:test';
import { app } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup } from '../helpers';

// The password endpoints live behind the better-auth catch-all, which Eden Treaty
// does not model, so they are driven through the app handler directly.
function signInWithPassword(email: string, password: string) {
  return app.handle(
    new Request('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  );
}

const credentials = {
  discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration',
  clientId: 'itsaplan',
  clientSecret: 'sh-secret',
};

const googleCredentials = {
  clientId: 'google-client',
  clientSecret: 'google-secret',
};

describe('god OIDC and password settings', () => {
  beforeEach(resetDb);

  describe('access', () => {
    it('refuses a plain user', async () => {
      await setup();
      const user = await addUser({ email: 'someone@example.com' });

      expect((await user.api.god['oidc-settings'].get()).status).toBe(403);
      expect((await user.api.god['oidc-settings'].put({ enabled: false })).status).toBe(403);
    });
  });

  describe('GET /god/oidc-settings', () => {
    it('reports an unconfigured provider with the redirect URI to register', async () => {
      const { god } = await setup();

      const res = await god.api.god['oidc-settings'].get();

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        enabled: false,
        label: '',
        discoveryUrl: '',
        clientId: '',
        hasClientSecret: false,
        scopes: ['openid', 'profile', 'email'],
        pkce: true,
        redirectUri: 'http://localhost:7002/api/auth/oauth2/callback/oidc',
      });
    });
  });

  describe('PUT /god/oidc-settings', () => {
    it('stores the credentials and never returns the secret', async () => {
      const { god } = await setup();

      const saved = await god.api.god['oidc-settings'].put({
        ...credentials,
        label: 'Acme SSO',
        enabled: true,
      });

      expect(saved.status).toBe(200);
      expect(saved.data).toMatchObject({
        enabled: true,
        label: 'Acme SSO',
        discoveryUrl: credentials.discoveryUrl,
        clientId: credentials.clientId,
        hasClientSecret: true,
      });
      expect(JSON.stringify(saved.data)).not.toContain(credentials.clientSecret);
    });

    it('keeps the stored secret when the field is sent empty', async () => {
      const { god } = await setup();
      await god.api.god['oidc-settings'].put({ ...credentials, enabled: true });

      const saved = await god.api.god['oidc-settings'].put({ clientSecret: '' });

      expect(saved.data).toMatchObject({ hasClientSecret: true, enabled: true });
    });

    it('refuses to enable a provider with no credentials', async () => {
      const { god } = await setup();

      const res = await god.api.god['oidc-settings'].put({ enabled: true });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({
        error: 'Add the discovery URL, client ID and secret first',
      });
    });

    it('refuses to enable a provider that is missing only the secret', async () => {
      const { god } = await setup();

      const res = await god.api.god['oidc-settings'].put({
        discoveryUrl: credentials.discoveryUrl,
        clientId: credentials.clientId,
        enabled: true,
      });

      expect(res.status).toBe(400);
    });
  });

  describe('turning off password sign-in', () => {
    it('refuses while no single sign-on provider is configured', async () => {
      const { god } = await setup();

      const before = await god.api.god['auth-settings'].get();
      expect(before.data).toMatchObject({ emailPassword: true, hasSsoProvider: false });

      const res = await god.api.god['auth-settings'].put({ emailPassword: false });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({
        error: 'Configure a single sign-on provider first',
      });
    });

    it('allows it once OIDC is usable, and reports it publicly', async () => {
      const { god } = await setup();
      await god.api.god['oidc-settings'].put({ ...credentials, label: 'Acme SSO', enabled: true });

      const res = await god.api.god['auth-settings'].put({ emailPassword: false });

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ emailPassword: false, hasSsoProvider: true });

      const config = await god.api['auth-config'].get();
      expect(config.data).toMatchObject({
        emailPassword: false,
        oidc: true,
        oidcLabel: 'Acme SSO',
      });
    });

    it('accepts a password sign-in while it is on and refuses it once it is off', async () => {
      const { god } = await setup();
      const user = await addUser({ email: 'member@example.com' });
      await god.api.god['oidc-settings'].put({ ...credentials, enabled: true });
      expect((await signInWithPassword(user.email, 'test-password-123')).status).toBe(200);
      await god.api.god['auth-settings'].put({ emailPassword: false });

      const res = await signInWithPassword(user.email, 'test-password-123');

      expect(res.status).toBe(403);
    });

    it('stops offering OIDC once the provider is disabled again', async () => {
      const { god } = await setup();
      await god.api.god['oidc-settings'].put({ ...credentials, enabled: true });
      await god.api.god['auth-settings'].put({ emailPassword: false });

      // Password sign-in has to come back first, or the instance would be left
      // with no way in at all.
      await god.api.god['auth-settings'].put({ emailPassword: true });
      await god.api.god['oidc-settings'].put({ enabled: false });

      const config = await god.api['auth-config'].get();
      expect(config.data).toMatchObject({ oidc: false, oidcLabel: '', emailPassword: true });
    });

    it('refuses to disable the only usable OIDC provider', async () => {
      const { god } = await setup();
      await god.api.god['oidc-settings'].put({ ...credentials, enabled: true });
      await god.api.god['auth-settings'].put({ emailPassword: false });

      const res = await god.api.god['oidc-settings'].put({ enabled: false });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({
        error: 'Enable password sign-in or another single sign-on provider first',
      });
      expect((await god.api.god['oidc-settings'].get()).data).toMatchObject({ enabled: true });
    });

    it('refuses to disable the only usable Google provider', async () => {
      const { god } = await setup();
      await god.api.god['google-settings'].put({ ...googleCredentials, enabled: true });
      await god.api.god['auth-settings'].put({ emailPassword: false });

      const res = await god.api.god['google-settings'].put({ enabled: false });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({
        error: 'Enable password sign-in or another single sign-on provider first',
      });
      expect((await god.api.god['google-settings'].get()).data).toMatchObject({ enabled: true });
    });
  });
});
