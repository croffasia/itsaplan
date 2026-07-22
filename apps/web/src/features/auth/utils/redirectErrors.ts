// Some auth failures reach the sign-in screen as a redirect rather than a rejected
// promise, and carry their reason in ?error=<code> (plus ?error_description=<text>
// when the instance itself refused — the registration gate passes its own message
// that way). Two flows land here: the Google round trip, and the confirmation link
// from the address verification email. Codes raised by better-auth carry no
// description, so the ones a visitor can act on are spelled out here.
// The address already has an account whose email was never confirmed. Linking a
// social account to an unconfirmed one is refused on purpose: anyone could have
// registered that address with a password before its owner arrived.
const LINK_REFUSED =
  'This email already has an account. Sign in with its password and confirm the address first, then Google can be used.';

const MESSAGES: Record<string, string> = {
  unable_to_link_account: LINK_REFUSED,
  account_not_linked: LINK_REFUSED,
  signup_disabled: 'This instance is not accepting new accounts.',
  email_not_found: 'Google did not return an email address for this account.',
  // The confirmation link failed. better-auth redirects with these uppercase codes.
  TOKEN_EXPIRED: 'This confirmation link has expired. Sign in below to get a new one.',
  INVALID_TOKEN: 'This confirmation link is not valid. Sign in below to get a new one.',
  USER_NOT_FOUND: 'This confirmation link belongs to an account that no longer exists.',
};

export function redirectErrorMessage(
  error: string | null,
  description: string | null,
): string | null {
  if (!error) return null;
  return MESSAGES[error] ?? description ?? 'Could not sign in with Google. Please try again.';
}
