'use client';

import { useState } from 'react';
import type { InstanceAuthSettings, RegistrationMode } from '@/lib/api/endpoints/god';
import { emailDomainsValid, parseEmailDomains } from '@/utils/emailDomains';
import { useUpdateInstanceAuthSettings } from '../services/god.service';

// The api's own limit on the invite lifetime.
export const MAX_INVITE_TTL_DAYS = 3650;

export interface GodPolicyForm {
  registration: RegistrationMode;
  setRegistration: (v: RegistrationMode) => void;
  requireEmailVerification: boolean;
  setRequireEmailVerification: (v: boolean) => void;
  magicLink: boolean;
  setMagicLink: (v: boolean) => void;
  emailPassword: boolean;
  setEmailPassword: (v: boolean) => void;
  trustProviderEmails: boolean;
  setTrustProviderEmails: (v: boolean) => void;
  // Kept as typed, so a half-written number can sit in the field without saving.
  inviteTtlDays: string;
  setInviteTtlDays: (v: string) => void;
  inviteTtlDaysValid: boolean;
  allowedEmailDomains: string;
  setAllowedEmailDomains: (v: string) => void;
  allowedEmailDomainsValid: boolean;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

// Held in local state rather than saved on change, so the whole page commits through
// one Save.
export function useGodPolicyForm(settings: InstanceAuthSettings): GodPolicyForm {
  const update = useUpdateInstanceAuthSettings();

  const [registration, setRegistration] = useState<RegistrationMode>(settings.registration);
  const [requireEmailVerification, setRequireEmailVerification] = useState(
    settings.requireEmailVerification,
  );
  const [magicLink, setMagicLink] = useState(settings.magicLink);
  const [emailPassword, setEmailPassword] = useState(settings.emailPassword);
  const [trustProviderEmails, setTrustProviderEmails] = useState(settings.trustProviderEmails);
  const [inviteTtlDays, setInviteTtlDays] = useState(String(settings.inviteTtlDays));
  const inviteTtlDaysValid =
    /^\d+$/.test(inviteTtlDays.trim()) && Number(inviteTtlDays) <= MAX_INVITE_TTL_DAYS;
  const [allowedEmailDomains, setAllowedEmailDomains] = useState(
    settings.allowedEmailDomains.join(', '),
  );
  const domains = parseEmailDomains(allowedEmailDomains);
  const allowedEmailDomainsValid = emailDomainsValid(domains);

  const dirty =
    registration !== settings.registration ||
    requireEmailVerification !== settings.requireEmailVerification ||
    magicLink !== settings.magicLink ||
    emailPassword !== settings.emailPassword ||
    trustProviderEmails !== settings.trustProviderEmails ||
    inviteTtlDays.trim() !== String(settings.inviteTtlDays) ||
    domains.join() !== settings.allowedEmailDomains.join();

  async function save() {
    // An empty field would be read as 0, which turns expiry off.
    if (!inviteTtlDaysValid || !allowedEmailDomainsValid) return;
    await update.mutateAsync({
      registration,
      requireEmailVerification,
      magicLink,
      emailPassword,
      trustProviderEmails,
      inviteTtlDays: Number(inviteTtlDays.trim()),
      allowedEmailDomains: domains,
    });
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
    trustProviderEmails,
    setTrustProviderEmails,
    inviteTtlDays,
    setInviteTtlDays,
    inviteTtlDaysValid,
    allowedEmailDomains,
    setAllowedEmailDomains,
    allowedEmailDomainsValid,
    dirty,
    saving: update.isPending,
    save,
  };
}
