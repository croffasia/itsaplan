'use client';

import { useState } from 'react';
import type { InstanceAuthentikSettings } from '@/lib/api/endpoints/god';
import { useUpdateInstanceAuthentikSettings } from '../services/god.service';

export interface GodAuthentikForm {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  discoveryUrl: string;
  setDiscoveryUrl: (value: string) => void;
  clientId: string;
  setClientId: (value: string) => void;
  clientSecret: string;
  setClientSecret: (value: string) => void;
  scopes: string;
  setScopes: (value: string) => void;
  hasCredentials: boolean;
  settings: InstanceAuthentikSettings;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

function parseScopes(value: string): string[] {
  return value.split(/[\s,]+/).filter(Boolean);
}

export function useGodAuthentikForm(settings: InstanceAuthentikSettings): GodAuthentikForm {
  const update = useUpdateInstanceAuthentikSettings();
  const [enabled, setEnabled] = useState(settings.enabled);
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
    discoveryUrl !== settings.discoveryUrl ||
    clientId !== settings.clientId ||
    clientSecret.length > 0 ||
    parseScopes(scopes).join(' ') !== settings.scopes.join(' ');

  async function save() {
    await update.mutateAsync({
      enabled: enabled && hasCredentials,
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
