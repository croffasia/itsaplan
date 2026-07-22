'use client';

import { useState } from 'react';
import type { InstanceGoogleSettings } from '@/lib/api';
import { useUpdateInstanceGoogleSettings } from '../services/god.service';

export interface GodGoogleForm {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  clientId: string;
  setClientId: (v: string) => void;
  clientSecret: string;
  setClientSecret: (v: string) => void;
  // Both credentials are present, counting a stored secret the user has not retyped.
  // The switch stays off without them: the API refuses it, and the sign-in button
  // would otherwise only fail at Google.
  hasCredentials: boolean;
  settings: InstanceGoogleSettings;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

// Form state for the Google OAuth credentials. Same contract as the mail provider:
// the secret starts blank and an empty field on save keeps the stored one.
export function useGodGoogleForm(settings: InstanceGoogleSettings): GodGoogleForm {
  const update = useUpdateInstanceGoogleSettings();

  const [enabled, setEnabled] = useState(settings.enabled);
  const [clientId, setClientId] = useState(settings.clientId);
  const [clientSecret, setClientSecret] = useState('');

  const hasCredentials =
    clientId.trim().length > 0 && (settings.hasClientSecret || clientSecret.length > 0);
  const dirty =
    enabled !== settings.enabled || clientId !== settings.clientId || clientSecret.length > 0;

  async function save() {
    await update.mutateAsync({
      enabled: enabled && hasCredentials,
      clientId: clientId.trim(),
      ...(clientSecret.length > 0 ? { clientSecret } : {}),
    });
    setClientSecret('');
  }

  return {
    enabled,
    setEnabled,
    clientId,
    setClientId,
    clientSecret,
    setClientSecret,
    hasCredentials,
    settings,
    dirty,
    saving: update.isPending,
    save,
  };
}
