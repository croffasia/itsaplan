'use client';

import { useState } from 'react';
import type { InstanceAuthSettings, RegistrationMode } from '@/lib/api';
import { useUpdateInstanceAuthSettings } from '../services/god.service';

export interface GodPolicyForm {
  registration: RegistrationMode;
  setRegistration: (v: RegistrationMode) => void;
  requireEmailVerification: boolean;
  setRequireEmailVerification: (v: boolean) => void;
  magicLink: boolean;
  setMagicLink: (v: boolean) => void;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

// Form state for the instance sign-in policy: who may register and the two options
// that need outbound mail. Held here rather than saved on change so the whole page,
// policy and provider credentials alike, commits through one Save.
export function useGodPolicyForm(settings: InstanceAuthSettings): GodPolicyForm {
  const update = useUpdateInstanceAuthSettings();

  const [registration, setRegistration] = useState<RegistrationMode>(settings.registration);
  const [requireEmailVerification, setRequireEmailVerification] = useState(
    settings.requireEmailVerification,
  );
  const [magicLink, setMagicLink] = useState(settings.magicLink);

  const dirty =
    registration !== settings.registration ||
    requireEmailVerification !== settings.requireEmailVerification ||
    magicLink !== settings.magicLink;

  async function save() {
    await update.mutateAsync({ registration, requireEmailVerification, magicLink });
  }

  return {
    registration,
    setRegistration,
    requireEmailVerification,
    setRequireEmailVerification,
    magicLink,
    setMagicLink,
    dirty,
    saving: update.isPending,
    save,
  };
}
