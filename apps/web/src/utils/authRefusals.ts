// What the auth server refuses a sign-in, sign-up or reset with, by code: a form's
// error and a round trip's ?error= alike. Its messages are English whatever the
// visitor's language, so they are shown by code instead. The values are keys under
// auth.errors in the catalogs. INVALID_TOKEN and USER_NOT_FOUND are left out: the
// confirmation link and the reset form mean different things by them.
export const AUTH_REFUSAL_KEYS = {
  REGISTRATION_CLOSED: 'registrationClosed',
  INVITE_ONLY: 'inviteOnly',
  EMAIL_DOMAIN_NOT_ALLOWED: 'emailDomainNotAllowed',
  ACCOUNT_DEACTIVATED: 'accountDeactivated',
  PASSWORD_AUTH_DISABLED: 'passwordDisabled',
  EMAIL_NOT_VERIFIED: 'emailNotVerified',
  // The sign-in form has one field for an address or a username; whatever is wrong
  // with it, the visitor's next step is the same.
  INVALID_EMAIL_OR_PASSWORD: 'invalidCredentials',
  INVALID_USERNAME_OR_PASSWORD: 'invalidCredentials',
  USERNAME_TOO_SHORT: 'invalidCredentials',
  USERNAME_TOO_LONG: 'invalidCredentials',
  INVALID_USERNAME: 'invalidCredentials',
  // The address is the only field these forms can send that fails the api's schema: the
  // password fields are required, and their length has codes of its own.
  INVALID_EMAIL: 'invalidEmail',
  VALIDATION_ERROR: 'invalidEmail',
  PASSWORD_TOO_SHORT: 'passwordTooShort',
  PASSWORD_TOO_LONG: 'passwordTooLong',
  USER_ALREADY_EXISTS: 'emailTaken',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'emailTaken',
} as const;

// The rate limiter answers 429 with a message and no code.
export function authRefusalKey(
  code: unknown,
  status?: number,
): (typeof AUTH_REFUSAL_KEYS)[keyof typeof AUTH_REFUSAL_KEYS] | 'tooManyRequests' | undefined {
  if (status === 429) return 'tooManyRequests';
  return typeof code === 'string' && Object.hasOwn(AUTH_REFUSAL_KEYS, code)
    ? AUTH_REFUSAL_KEYS[code as keyof typeof AUTH_REFUSAL_KEYS]
    : undefined;
}
