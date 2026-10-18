import { describe, expect, it } from 'bun:test';
import { buildSpMetadata, parseIdpMetadata } from '@repo/auth/saml';
import { IDP_METADATA } from '../fixtures/saml';

const withoutSigningKey = IDP_METADATA.replace('use="signing"', 'use="encryption"');

describe('parseIdpMetadata', () => {
  it('reads the entity id and prefers the HTTP-Redirect sign-on URL', () => {
    expect(parseIdpMetadata(IDP_METADATA)).toEqual({
      entityId: 'https://idp.example.com/saml',
      ssoUrl: 'https://idp.example.com/saml/redirect',
    });
  });

  it('falls back to the HTTP-POST sign-on URL', () => {
    const postOnly = IDP_METADATA.replace(/<md:SingleSignOnService[^>]*HTTP-Redirect[^>]*\/>/, '');

    expect(parseIdpMetadata(postOnly).ssoUrl).toBe('https://idp.example.com/saml/post');
  });

  it('finds the identity provider inside an aggregate', () => {
    const aggregate = `<md:EntitiesDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata">
      <md:EntityDescriptor entityID="https://sp.example.com"><md:SPSSODescriptor/></md:EntityDescriptor>
      ${IDP_METADATA.replace(/<\?xml[^>]*\?>/, '')}
    </md:EntitiesDescriptor>`;

    expect(parseIdpMetadata(aggregate).entityId).toBe('https://idp.example.com/saml');
  });

  it('accepts a key descriptor that names no use', () => {
    expect(() => parseIdpMetadata(IDP_METADATA.replace(' use="signing"', ''))).not.toThrow();
  });

  it.each([
    ['not XML', '<md:EntityDescriptor', 'The metadata is not valid XML'],
    [
      'service provider metadata',
      buildSpMetadata({ entityId: 'https://sp.example.com', acsUrl: 'https://sp.example.com/acs' }),
      'The metadata describes no identity provider',
    ],
    [
      'no entity id',
      IDP_METADATA.replace(' entityID="https://idp.example.com/saml"', ''),
      'The metadata has no entityID',
    ],
    [
      'no sign-on URL',
      IDP_METADATA.replace(/<md:SingleSignOnService[^>]*\/>/g, ''),
      'The metadata has no HTTP-Redirect or HTTP-POST sign-on URL',
    ],
    ['only an encryption key', withoutSigningKey, 'The metadata has no signing certificate'],
  ])('refuses %s', (_case, xml, message) => {
    expect(() => parseIdpMetadata(xml)).toThrow(message);
  });
});

describe('buildSpMetadata', () => {
  it('names the ACS URL and escapes the entity id', () => {
    const xml = buildSpMetadata({
      entityId: 'https://api.example.com/x?a=1&b="2"',
      acsUrl: 'https://api.example.com/api/auth/sso/saml2/sp/acs/saml',
    });

    expect(xml).toContain('entityID="https://api.example.com/x?a=1&amp;b=&quot;2&quot;"');
    expect(xml).toContain('Location="https://api.example.com/api/auth/sso/saml2/sp/acs/saml"');
    expect(xml).toContain('WantAssertionsSigned="true"');
  });
});
