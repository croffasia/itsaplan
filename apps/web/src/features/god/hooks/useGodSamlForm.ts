'use client';

import { useState } from 'react';
import type { InstanceAuthSettings, InstanceSamlSettings } from '@/lib/api/endpoints/god';
import {
  useUpdateInstanceAuthSettings,
  useUpdateInstanceSamlSettings,
} from '../services/god.service';

export interface GodSamlForm {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  label: string;
  setLabel: (v: string) => void;
  // The XML pasted in this session; the stored document is never sent back.
  metadataXml: string;
  setMetadataXml: (v: string) => void;
  metadataUrl: string;
  setMetadataUrl: (v: string) => void;
  entityId: string;
  setEntityId: (v: string) => void;
  emailAttribute: string;
  setEmailAttribute: (v: string) => void;
  nameAttribute: string;
  setNameAttribute: (v: string) => void;
  // Password sign-in off, so the identity providers are the only way in.
  ssoOnly: boolean;
  setSsoOnly: (v: boolean) => void;
  // Metadata is stored or about to be sent. The switch stays off without it: the API
  // refuses it.
  hasMetadata: boolean;
  settings: InstanceSamlSettings;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

// Form state for the SAML provider. "SSO only" is the instance's password switch from
// the authentication settings, written after the provider so that turning both on in
// one save finds SAML usable.
export function useGodSamlForm(
  settings: InstanceSamlSettings,
  authSettings: InstanceAuthSettings,
): GodSamlForm {
  const update = useUpdateInstanceSamlSettings();
  const updateAuth = useUpdateInstanceAuthSettings();

  const [enabled, setEnabled] = useState(settings.enabled);
  const [label, setLabel] = useState(settings.label);
  const [metadataXml, setMetadataXml] = useState('');
  const [metadataUrl, setMetadataUrl] = useState(settings.idpMetadataUrl);
  const [entityId, setEntityId] = useState(settings.entityId);
  const [emailAttribute, setEmailAttribute] = useState(settings.emailAttribute);
  const [nameAttribute, setNameAttribute] = useState(settings.nameAttribute);
  const [ssoOnly, setSsoOnly] = useState(!authSettings.emailPassword);

  const urlChanged = metadataUrl.trim() !== settings.idpMetadataUrl;
  const hasMetadata =
    settings.hasIdpMetadata || metadataXml.trim().length > 0 || metadataUrl.trim().length > 0;

  const samlDirty =
    enabled !== settings.enabled ||
    label !== settings.label ||
    metadataXml.trim().length > 0 ||
    urlChanged ||
    entityId !== settings.entityId ||
    emailAttribute !== settings.emailAttribute ||
    nameAttribute !== settings.nameAttribute;
  const ssoOnlyDirty = ssoOnly === authSettings.emailPassword;

  async function save() {
    if (samlDirty) {
      await update.mutateAsync({
        enabled: enabled && hasMetadata,
        label: label.trim(),
        entityId: entityId.trim(),
        emailAttribute: emailAttribute.trim(),
        nameAttribute: nameAttribute.trim(),
        ...(metadataXml.trim() ? { idpMetadataXml: metadataXml.trim() } : {}),
        // Sent only when changed: the API fetches the document again for every URL it gets.
        ...(urlChanged ? { idpMetadataUrl: metadataUrl.trim() } : {}),
      });
      setMetadataXml('');
    }
    if (ssoOnlyDirty) await updateAuth.mutateAsync({ emailPassword: !ssoOnly });
  }

  return {
    enabled,
    setEnabled,
    label,
    setLabel,
    metadataXml,
    setMetadataXml,
    metadataUrl,
    setMetadataUrl,
    entityId,
    setEntityId,
    emailAttribute,
    setEmailAttribute,
    nameAttribute,
    setNameAttribute,
    ssoOnly,
    setSsoOnly,
    hasMetadata,
    settings,
    dirty: samlDirty || ssoOnlyDirty,
    saving: update.isPending || updateAuth.isPending,
    save,
  };
}
