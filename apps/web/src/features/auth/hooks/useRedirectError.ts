'use client';

import { useTranslations } from 'next-intl';
import { AUTH_REFUSAL_KEYS } from '@/utils/authRefusals';

// Some auth failures reach the sign-in screen as a redirect rather than a rejected
// promise, and carry their reason in ?error=<code> (plus ?error_description=<text>
// when the instance itself refused — the registration gate passes its own message
// that way). Five flows land here: the Google round trip, the OIDC one, the magic link,
// the confirmation link from the address verification email, and an MCP authorization
// the api could not hand back to its client. Codes raised by better-auth carry no
// description, or one written for developers (an unknown MCP client arrives as
// "client_id is required"), and the gate's is in English, so the ones a visitor can act
// on are spelled out here.
//
// Linking a provider account to an account whose email was never confirmed is refused
// unless the instance trusts provider addresses: anyone could have registered that
// address with a password before its owner arrived.
const MESSAGE_KEYS = {
  unable_to_link_account: 'linkRefused',
  account_not_linked: 'linkRefused',
  signup_disabled: 'signupDisabled',
  INVITE_EXPIRED: 'inviteExpired',
  OIDC_DISABLED: 'ssoDisabled',
  email_not_found: 'emailNotFound',
  // The confirmation link failed. better-auth redirects with these uppercase codes.
  TOKEN_EXPIRED: 'tokenExpired',
  INVALID_TOKEN: 'invalidToken',
  USER_NOT_FOUND: 'userNotFound',
  ...AUTH_REFUSAL_KEYS,
  // The client or its return address is unknown: a client can keep a registration the
  // instance has since lost, as an upgrade that drops the old ones does.
  invalid_client: 'oauthClientUnknown',
  invalid_redirect: 'oauthRedirectUnknown',
  client_disabled: 'oauthClientRefused',
  unauthorized_client: 'oauthClientRefused',
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
    // A build that sends codes of its own names their texts under auth.errors.codes.
    const own = `codes.${error}` as Parameters<typeof t.has>[0];
    if (t.has(own)) return t(own);
    return description ?? t('generic');
  };
}
