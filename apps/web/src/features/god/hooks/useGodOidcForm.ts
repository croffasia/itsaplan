'use client';

import { useState } from 'react';
import type { InstanceOidcSettings } from '@/lib/api';
import { useUpdateInstanceOidcSettings } from '../services/god.service';

export interface GodOidcForm {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  label: string;
  setLabel: (v: string) => void;
  discoveryUrl: string;
  setDiscoveryUrl: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  clientSecret: string;
  setClientSecret: (v: string) => void;
  // Space-separated in the field, an array over the wire.
  scopes: string;
  setScopes: (v: string) => void;
  // Discovery URL, client id and secret are all present, counting a stored secret
  // the user has not retyped. The switch stays off without them: the API refuses it,
  // and the sign-in button would otherwise only fail at the provider.
  hasCredentials: boolean;
  settings: InstanceOidcSettings;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

function parseScopes(value: string): string[] {
  return value.split(/[\s,]+/).filter(Boolean);
}

// Form state for the generic OIDC provider. Same contract as the Google credentials:
// the secret starts blank and an empty field on save keeps the stored one.
export function useGodOidcForm(settings: InstanceOidcSettings): GodOidcForm {
  const update = useUpdateInstanceOidcSettings();

  const [enabled, setEnabled] = useState(settings.enabled);
  const [label, setLabel] = useState(settings.label);
  const [discoveryUrl, setDiscoveryUrl] = useState(settings.discoveryUrl);
  const [clientId, setClientId] = useState(settings.clientId);
  const [clientSecret, setClientSecret] = useState('');
  const [scopes, setScopes] = useState(settings.scopes.join(' '));

  const hasCredentials =
    discoveryUrl.trim().length > 0 &&
    clientId.trim().length > 0 &&
    (settings.hasClientSecret || clientSecret.length > 0);

  const dirty =
    enabled !== settings.enabled ||
    label !== settings.label ||
    discoveryUrl !== settings.discoveryUrl ||
    clientId !== settings.clientId ||
    clientSecret.length > 0 ||
    parseScopes(scopes).join(' ') !== settings.scopes.join(' ');

  async function save() {
    await update.mutateAsync({
      enabled: enabled && hasCredentials,
      label: label.trim(),
      discoveryUrl: discoveryUrl.trim(),
      clientId: clientId.trim(),
      scopes: parseScopes(scopes),
      ...(clientSecret.length > 0 ? { clientSecret } : {}),
    });
    setClientSecret('');
  }

  return {
    enabled,
    setEnabled,
    label,
    setLabel,
    discoveryUrl,
    setDiscoveryUrl,
    clientId,
    setClientId,
    clientSecret,
    setClientSecret,
    scopes,
    setScopes,
    hasCredentials,
    settings,
    dirty,
    saving: update.isPending,
    save,
  };
}
