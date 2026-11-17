'use client';

import { useState } from 'react';
import type { InstanceAuthSettings, RegistrationMode } from '@/lib/api/endpoints/god';
import { emailDomainsValid, parseEmailDomains } from '@/utils/emailDomains';
import { useUpdateInstanceAuthSettings } from '../services/god.service';
import { wholeNumberIn } from '../utils/numbers';

// The api's own limit on the invite lifetime.
export const MAX_INVITE_TTL_DAYS = 3650;
// The api's own range for a sign-in rate limit.
export const MAX_AUTH_RATE_LIMIT = 1000;

export const SIGN_IN_LIMITS = ['signInRateLimit', 'emailRateLimit', 'magicLinkRateLimit'] as const;
export type SignInLimit = (typeof SIGN_IN_LIMITS)[number];

const isLimitValid = (value: string) => wholeNumberIn(value, 1, MAX_AUTH_RATE_LIMIT);

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
  // Kept as typed, like the invite lifetime.
  limits: Record<SignInLimit, string>;
  setLimit: (limit: SignInLimit, value: string) => void;
  limitValid: (limit: SignInLimit) => boolean;
  limitsValid: boolean;
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
  const inviteTtlDaysValid = wholeNumberIn(inviteTtlDays, 0, MAX_INVITE_TTL_DAYS);
  const [allowedEmailDomains, setAllowedEmailDomains] = useState(
    settings.allowedEmailDomains.join(', '),
  );
  const domains = parseEmailDomains(allowedEmailDomains);
  const allowedEmailDomainsValid = emailDomainsValid(domains);
  const [limits, setLimits] = useState(
    () =>
      Object.fromEntries(SIGN_IN_LIMITS.map((limit) => [limit, String(settings[limit])])) as Record<
        SignInLimit,
        string
      >,
  );
  const limitsValid = SIGN_IN_LIMITS.every((limit) => isLimitValid(limits[limit]));

  const dirty =
    registration !== settings.registration ||
    requireEmailVerification !== settings.requireEmailVerification ||
    magicLink !== settings.magicLink ||
    emailPassword !== settings.emailPassword ||
    trustProviderEmails !== settings.trustProviderEmails ||
    inviteTtlDays.trim() !== String(settings.inviteTtlDays) ||
    domains.join() !== settings.allowedEmailDomains.join() ||
    SIGN_IN_LIMITS.some((limit) => limits[limit].trim() !== String(settings[limit]));

  async function save() {
    // An empty field would be read as 0, which turns expiry off.
    if (!inviteTtlDaysValid || !allowedEmailDomainsValid || !limitsValid) return;
    await update.mutateAsync({
      registration,
      requireEmailVerification,
      magicLink,
      emailPassword,
      trustProviderEmails,
      inviteTtlDays: Number(inviteTtlDays.trim()),
      allowedEmailDomains: domains,
      signInRateLimit: Number(limits.signInRateLimit.trim()),
      emailRateLimit: Number(limits.emailRateLimit.trim()),
      magicLinkRateLimit: Number(limits.magicLinkRateLimit.trim()),
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
    limits,
    setLimit: (limit, value) => setLimits((current) => ({ ...current, [limit]: value })),
    limitValid: (limit) => isLimitValid(limits[limit]),
    limitsValid,
    dirty,
    saving: update.isPending,
    save,
  };
}
