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
  emailPassword: boolean;
  setEmailPassword: (v: boolean) => void;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

// Form state for the instance sign-in policy: who may register, whether the
// email/password form is offered at all, and the two options that need outbound
// mail. Held here rather than saved on change so the whole page commits through one
// Save.
export function useGodPolicyForm(settings: InstanceAuthSettings): GodPolicyForm {
  const update = useUpdateInstanceAuthSettings();

  const [registration, setRegistration] = useState<RegistrationMode>(settings.registration);
  const [requireEmailVerification, setRequireEmailVerification] = useState(
    settings.requireEmailVerification,
  );
  const [magicLink, setMagicLink] = useState(settings.magicLink);
  const [emailPassword, setEmailPassword] = useState(settings.emailPassword);

  const dirty =
    registration !== settings.registration ||
    requireEmailVerification !== settings.requireEmailVerification ||
    magicLink !== settings.magicLink ||
    emailPassword !== settings.emailPassword;

  async function save() {
    await update.mutateAsync({ registration, requireEmailVerification, magicLink, emailPassword });
  }

  return {
    registration,
    setRegistration,
    requireEmailVerification,
    setRequireEmailVerification,
    magicLink,
    setMagicLink,
    emailPassword,
    setEmailPassword,
    dirty,
    saving: update.isPending,
    save,
  };
}
