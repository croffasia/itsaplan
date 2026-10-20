// The registration gate's refusals, by the codes the api sends with them on every
// sign-up path: a form's error and a round trip's ?error= alike. The values are keys
// under auth.errors in the catalogs.
export const REGISTRATION_REFUSAL_KEYS = {
  REGISTRATION_CLOSED: 'registrationClosed',
  INVITE_ONLY: 'inviteOnly',
  EMAIL_DOMAIN_NOT_ALLOWED: 'emailDomainNotAllowed',
} as const;

export function registrationRefusalKey(
  code: unknown,
): (typeof REGISTRATION_REFUSAL_KEYS)[keyof typeof REGISTRATION_REFUSAL_KEYS] | undefined {
  return typeof code === 'string' && Object.hasOwn(REGISTRATION_REFUSAL_KEYS, code)
    ? REGISTRATION_REFUSAL_KEYS[code as keyof typeof REGISTRATION_REFUSAL_KEYS]
    : undefined;
}
