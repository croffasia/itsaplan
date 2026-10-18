import { describe, expect, it, beforeEach } from 'bun:test';
import { app } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { signUpTestUser } from '#tests/helpers/auth';
import { addUser, setup } from '../helpers';
import { FORGED_SIGNATURE, IDP_METADATA, samlResponse } from '../fixtures/saml';

const API = process.env.API_URL!.replace(/\/+$/, '');

// The SAML endpoints live behind the better-auth catch-all, which Eden Treaty does not
// model, so they are driven through the app handler directly.
function authRequest(path: string, init: RequestInit = {}) {
  return app.handle(new Request(`http://localhost/api/auth${path}`, init));
}

function startSamlSignIn() {
  return authRequest('/sign-in/sso', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3001' },
    body: JSON.stringify({
      providerId: 'saml',
      callbackURL: 'http://localhost:3001/',
      errorCallbackURL: 'http://localhost:3001/login',
    }),
  });
}

describe('god SAML settings', () => {
  beforeEach(resetDb);

  describe('access', () => {
    it('refuses a plain user', async () => {
      await setup();
      const user = await addUser({ email: 'someone@example.com' });

      expect((await user.api.god['saml-settings'].get()).status).toBe(403);
      expect(
        (await user.api.god['saml-settings'].put({ idpMetadataXml: IDP_METADATA })).status,
      ).toBe(403);
    });
  });

  describe('GET /god/saml-settings', () => {
    it('reports an unconfigured provider with the values to give the IdP', async () => {
      const { god } = await setup();

      const res = await god.api.god['saml-settings'].get();

      expect(res.status).toBe(200);
      expect(res.data).toEqual({
        enabled: false,
        label: '',
        idpMetadataUrl: '',
        hasIdpMetadata: false,
        idpEntityId: '',
        idpSsoUrl: '',
        entityId: '',
        emailAttribute: '',
        nameAttribute: '',
        acsUrl: `${API}/api/auth/sso/saml2/sp/acs/saml`,
        defaultEntityId: `${API}/api/auth/sso/saml2/sp/metadata?providerId=saml`,
        spMetadataUrl: `${API}/api/auth/sso/saml2/sp/metadata?providerId=saml`,
      });
    });
  });

  describe('PUT /god/saml-settings', () => {
    it('stores the metadata and the mapping, and reports what the metadata names', async () => {
      const { god } = await setup();

      const saved = await god.api.god['saml-settings'].put({
        idpMetadataXml: IDP_METADATA,
        label: 'Acme SAML',
        entityId: 'https://planner.example.com',
        emailAttribute: 'mail',
        nameAttribute: 'cn',
        enabled: true,
      });

      expect(saved.status).toBe(200);
      expect(saved.data).toMatchObject({
        enabled: true,
        label: 'Acme SAML',
        hasIdpMetadata: true,
        idpEntityId: 'https://idp.example.com/saml',
        idpSsoUrl: 'https://idp.example.com/saml/redirect',
        entityId: 'https://planner.example.com',
        emailAttribute: 'mail',
        nameAttribute: 'cn',
      });
      expect((await god.api.god['saml-settings'].get()).data).toEqual(saved.data!);
    });

    it('keeps the stored metadata on a write that does not carry it', async () => {
      const { god } = await setup();
      await god.api.god['saml-settings'].put({ idpMetadataXml: IDP_METADATA });

      const saved = await god.api.god['saml-settings'].put({ label: 'Acme' });

      expect(saved.data).toMatchObject({ hasIdpMetadata: true, label: 'Acme' });
    });

    it('refuses metadata that describes no identity provider', async () => {
      const { god } = await setup();

      const res = await god.api.god['saml-settings'].put({
        idpMetadataXml: IDP_METADATA.replace(/<md:SingleSignOnService[^>]*\/>/g, ''),
      });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({
        error: 'The metadata has no HTTP-Redirect or HTTP-POST sign-on URL',
      });
      expect((await god.api.god['saml-settings'].get()).data).toMatchObject({
        hasIdpMetadata: false,
      });
    });

    it('refuses text that is not XML', async () => {
      const { god } = await setup();

      const res = await god.api.god['saml-settings'].put({ idpMetadataXml: 'not xml <' });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({ error: 'The metadata is not valid XML' });
    });

    it('refuses to enable a provider with no metadata', async () => {
      const { god } = await setup();

      const res = await god.api.god['saml-settings'].put({ enabled: true });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({
        error: 'Add the identity provider metadata first',
      });
    });

    it('refuses a metadata URL on a private address', async () => {
      const { god } = await setup();

      const res = await god.api.god['saml-settings'].put({
        idpMetadataUrl: 'http://127.0.0.1/metadata',
      });

      expect(res.status).toBe(400);
      expect((await god.api.god['saml-settings'].get()).data).toMatchObject({
        idpMetadataUrl: '',
        hasIdpMetadata: false,
      });
    });

    it('refuses a metadata URL that is not a URL', async () => {
      const { god } = await setup();

      const res = await god.api.god['saml-settings'].put({ idpMetadataUrl: 'idp metadata' });

      expect(res.status).toBe(400);
    });

    it('takes a 60-character label and refuses a 61-character one', async () => {
      const { god } = await setup();

      const ok = await god.api.god['saml-settings'].put({ label: 'a'.repeat(60) });
      const tooLong = await god.api.god['saml-settings'].put({ label: 'a'.repeat(61) });

      expect(ok.status).toBe(200);
      expect(tooLong.status).toBe(400);
    });
  });

  describe('single sign-on only', () => {
    it('lets password sign-in be turned off once SAML is usable, and reports it publicly', async () => {
      const { god } = await setup();
      await god.api.god['saml-settings'].put({
        idpMetadataXml: IDP_METADATA,
        label: 'Acme SAML',
        enabled: true,
      });

      const res = await god.api.god['auth-settings'].put({ emailPassword: false });

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ emailPassword: false, hasSsoProvider: true });
      expect((await god.api['auth-config'].get()).data).toMatchObject({
        emailPassword: false,
        saml: true,
        samlLabel: 'Acme SAML',
      });
    });

    it('refuses to disable SAML while it is the only way in', async () => {
      const { god } = await setup();
      await god.api.god['saml-settings'].put({ idpMetadataXml: IDP_METADATA, enabled: true });
      await god.api.god['auth-settings'].put({ emailPassword: false });

      const res = await god.api.god['saml-settings'].put({ enabled: false });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({
        error: 'Enable password sign-in or another single sign-on provider first',
      });
    });

    it('does not offer SAML that is configured but switched off', async () => {
      const { god } = await setup();
      await god.api.god['saml-settings'].put({ idpMetadataXml: IDP_METADATA, label: 'Acme' });

      expect((await god.api['auth-config'].get()).data).toMatchObject({
        saml: false,
        samlLabel: '',
      });
    });
  });

  describe('the sign-in endpoints', () => {
    it('refuses to start a sign-in while SAML is off', async () => {
      await setup();

      const res = await startSamlSignIn();

      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: 'SAML_DISABLED' });
    });

    it("starts a sign-in at the IdP's sign-on URL once SAML is on", async () => {
      const { god } = await setup();
      await god.api.god['saml-settings'].put({ idpMetadataXml: IDP_METADATA, enabled: true });

      const res = await startSamlSignIn();

      expect(res.status).toBe(200);
      const body = (await res.json()) as { url: string };
      expect(body.url.startsWith('https://idp.example.com/saml/redirect?SAMLRequest=')).toBe(true);
    });

    it('sends a response posted while SAML is off back to the sign-in screen', async () => {
      await setup();

      const res = await authRequest('/sso/saml2/sp/acs/saml', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'SAMLResponse=PHNhbWxwOlJlc3BvbnNlLz4%3D',
      });

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('http://localhost:3001/login?error=SAML_DISABLED');
    });

    for (const [name, signature] of [
      ['an unsigned', ''],
      ['a wrongly signed', FORGED_SIGNATURE],
    ]) {
      it(`refuses ${name} response posted to the ACS`, async () => {
        const { god } = await setup();
        await god.api.god['saml-settings'].put({ idpMetadataXml: IDP_METADATA, enabled: true });

        const res = await authRequest('/sso/saml2/sp/acs/saml', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            SAMLResponse: Buffer.from(samlResponse(signature)).toString('base64'),
          }).toString(),
        });

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toContain('error=saml_error');
        expect(res.headers.get('set-cookie')).toBeNull();
      });
    }

    it('serves the SP metadata with the ACS URL and the entity id god mode set', async () => {
      const { god } = await setup();
      await god.api.god['saml-settings'].put({
        idpMetadataXml: IDP_METADATA,
        entityId: 'https://planner.example.com',
      });

      const res = await authRequest('/sso/saml2/sp/metadata?providerId=saml');

      expect(res.status).toBe(200);
      const xml = await res.text();
      expect(xml).toContain('entityID="https://planner.example.com"');
      expect(xml).toContain(`Location="${API}/api/auth/sso/saml2/sp/acs/saml"`);
    });

    it('does not expose domain verification', async () => {
      await setup();
      const { cookie } = await signUpTestUser({ email: 'someone@example.com' });

      for (const path of ['/sso/request-domain-verification', '/sso/verify-domain']) {
        const res = await authRequest(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({ providerId: 'saml' }),
        });
        expect(res.status).toBe(404);
      }
    });

    it('does not let a signed-in user register an identity provider', async () => {
      await setup();
      const { cookie } = await signUpTestUser({ email: 'someone@example.com' });

      const res = await authRequest('/sso/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          providerId: 'other',
          issuer: 'https://idp.other.example',
          domain: 'example.com',
        }),
      });

      expect(res.status).toBe(404);
    });
  });
});
