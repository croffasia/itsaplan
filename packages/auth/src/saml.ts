import { XMLParser, XMLValidator } from 'fast-xml-parser';

// What god mode shows of the identity provider's metadata, and the check that the
// document can sign anyone in at all. The SSO plugin parses the same XML again for each
// sign-in; this only refuses a document it would fail on, at save time.
export interface IdpMetadataSummary {
  entityId: string;
  ssoUrl: string;
}

export class SamlMetadataError extends Error {}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  processEntities: false,
});

const REDIRECT_BINDING = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect';
const POST_BINDING = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST';

type Node = Record<string, unknown>;

const list = (value: unknown): Node[] =>
  (Array.isArray(value) ? value : value === undefined ? [] : [value]) as Node[];

// The single entity, or the first one of an aggregate that is an identity provider.
function findIdpEntity(doc: Node): Node | undefined {
  const entities = [
    ...list(doc.EntityDescriptor),
    ...list(doc.EntitiesDescriptor).flatMap((group) => list(group.EntityDescriptor)),
  ];
  return entities.find((entity) => list(entity.IDPSSODescriptor).length > 0);
}

function hasSigningCertificate(descriptor: Node): boolean {
  return list(descriptor.KeyDescriptor).some((key) => {
    if (key.use === 'encryption') return false;
    const data = list(list(key.KeyInfo)[0]?.X509Data)[0];
    const cert = data?.X509Certificate;
    return typeof cert === 'string' ? cert.trim().length > 0 : cert !== undefined;
  });
}

export function parseIdpMetadata(xml: string): IdpMetadataSummary {
  if (XMLValidator.validate(xml) !== true) {
    throw new SamlMetadataError('The metadata is not valid XML');
  }
  const doc = parser.parse(xml) as Node;
  const entity = findIdpEntity(doc);
  if (!entity) throw new SamlMetadataError('The metadata describes no identity provider');
  const entityId = typeof entity.entityID === 'string' ? entity.entityID : '';
  if (!entityId) throw new SamlMetadataError('The metadata has no entityID');

  const descriptor = list(entity.IDPSSODescriptor)[0]!;
  const services = list(descriptor.SingleSignOnService);
  const service =
    services.find((s) => s.Binding === REDIRECT_BINDING) ??
    services.find((s) => s.Binding === POST_BINDING);
  const ssoUrl = typeof service?.Location === 'string' ? service.Location : '';
  if (!ssoUrl) {
    throw new SamlMetadataError('The metadata has no HTTP-Redirect or HTTP-POST sign-on URL');
  }
  if (!hasSigningCertificate(descriptor)) {
    throw new SamlMetadataError('The metadata has no signing certificate');
  }
  return { entityId, ssoUrl };
}

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The plugin builds its own SP metadata from the origin-only baseURL, which lacks the
// path of an API_URL behind a path prefix. This one names the public ACS URL, which the
// plugin then also accepts as the response's recipient.
export function buildSpMetadata({ entityId, acsUrl }: { entityId: string; acsUrl: string }) {
  return [
    '<?xml version="1.0"?>',
    `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${escapeAttribute(entityId)}">`,
    '<md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">',
    '<md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>',
    `<md:AssertionConsumerService Binding="${POST_BINDING}" Location="${escapeAttribute(acsUrl)}" index="1"/>`,
    '</md:SPSSODescriptor>',
    '</md:EntityDescriptor>',
  ].join('');
}
