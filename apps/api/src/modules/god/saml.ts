import {
  SAML_ACS_URL,
  SAML_SP_ENTITY_ID,
  SAML_SP_METADATA_URL,
  getSamlConfig,
  parseIdpMetadata,
  SamlMetadataError,
  type InstanceSamlConfig,
  type InstanceSamlPatch,
} from '@repo/auth';
import { pinnedFetch } from '#shared/net';
import { HttpError } from '#shared/lib';

const METADATA_MAX_BYTES = 1024 * 1024;

// The settings as god mode reads them: the metadata summarised rather than returned,
// and the values to give the IdP.
export function toSamlSettings(config: InstanceSamlConfig) {
  const idp = config.idpMetadataXml ? parseIdpMetadata(config.idpMetadataXml) : null;
  return {
    enabled: config.enabled,
    label: config.label,
    idpMetadataUrl: config.idpMetadataUrl,
    hasIdpMetadata: idp !== null,
    idpEntityId: idp?.entityId ?? '',
    idpSsoUrl: idp?.ssoUrl ?? '',
    entityId: config.entityId,
    emailAttribute: config.emailAttribute,
    nameAttribute: config.nameAttribute,
    acsUrl: SAML_ACS_URL,
    defaultEntityId: SAML_SP_ENTITY_ID,
    spMetadataUrl: SAML_SP_METADATA_URL,
  };
}

async function fetchMetadata(url: string): Promise<string> {
  let response: Response;
  try {
    response = await pinnedFetch(url, {
      headers: { accept: 'application/samlmetadata+xml, application/xml, text/xml' },
      timeoutMs: 10_000,
      maxBytes: METADATA_MAX_BYTES,
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'The metadata URL could not be reached');
  }
  if (!response.ok) {
    throw new HttpError(400, `The metadata URL answered ${response.status}`);
  }
  return response.text();
}

// Resolves a write into the config to store. A metadata URL sent without XML is fetched
// now and its document stored, so a sign-in never depends on the IdP answering it. The
// document is checked before it is kept.
export async function resolveSamlPatch(patch: InstanceSamlPatch): Promise<InstanceSamlConfig> {
  const next = { ...(await getSamlConfig()), ...patch };
  if (patch.idpMetadataUrl && !patch.idpMetadataXml) {
    next.idpMetadataXml = await fetchMetadata(patch.idpMetadataUrl);
  }
  next.idpMetadataXml = next.idpMetadataXml.trim();
  if (next.idpMetadataXml) {
    try {
      parseIdpMetadata(next.idpMetadataXml);
    } catch (error) {
      if (error instanceof SamlMetadataError) throw new HttpError(400, error.message);
      throw error;
    }
  }
  if (next.enabled && !next.idpMetadataXml) {
    throw new HttpError(400, 'Add the identity provider metadata first');
  }
  return next;
}
