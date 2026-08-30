'use client';

import { useTranslations } from 'next-intl';

// Some auth failures reach the sign-in screen as a redirect rather than a rejected
// promise, and carry their reason in ?error=<code> (plus ?error_description=<text>
// when the instance itself refused — the registration gate passes its own message
// that way). Two flows land here: the Google round trip, and the confirmation link
// from the address verification email. Codes raised by better-auth carry no
// description, so the ones a visitor can act on are spelled out here.
//
// Linking a social account to an account whose email was never confirmed is refused
// on purpose: anyone could have registered that address with a password before its
// owner arrived.
const MESSAGE_KEYS = {
  unable_to_link_account: 'linkRefused',
  account_not_linked: 'linkRefused',
  signup_disabled: 'signupDisabled',
  OIDC_DISABLED: 'ssoDisabled',
  PASSWORD_AUTH_DISABLED: 'passwordDisabled',
  ACCOUNT_DEACTIVATED: 'accountDeactivated',
  email_not_found: 'emailNotFound',
  // The confirmation link failed. better-auth redirects with these uppercase codes.
  TOKEN_EXPIRED: 'tokenExpired',
  INVALID_TOKEN: 'invalidToken',
  USER_NOT_FOUND: 'userNotFound',
} as const;

export function useRedirectError() {
  const t = useTranslations('auth.errors');

  return function redirectErrorMessage(
    error: string | null,
    description: string | null,
  ): string | null {
    if (!error) return null;
    const key = MESSAGE_KEYS[error as keyof typeof MESSAGE_KEYS];
    if (key) return t(key);
    return description ?? t('google');
  };
}
