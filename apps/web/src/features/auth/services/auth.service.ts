import {
  signIn,
  signUp,
  signOut,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
} from '@/lib/auth-client';

// Where a link in an email lands the reader. The auth handler runs on the API
// origin, so every link it builds needs the web origin passed in explicitly —
// without it better-auth sends the reader back to the API, which renders nothing.
const appUrl = (path: string) =>
  typeof window === 'undefined' ? path : `${window.location.origin}${path}`;

// Each call throws with the API message on failure; on success the session cookie
// is set and the proxy lets the user into the planner. A failure without a
// message throws an empty one, and the caller (useAuthAction) words it.

// Sign-in was refused because the address is not confirmed yet. The only 403 the
// sign-in endpoint raises is the verification gate in @repo/auth, so the status is
// enough to tell it apart from wrong credentials and offer the link again.
export class EmailNotConfirmedError extends Error {}

// The sign-in screen has one field for two identifiers: an address goes to
// /sign-in/email, anything else to /sign-in/username. An address is the only thing
// that can carry an "@", so that is what tells them apart.
export function isEmailAddress(identifier: string): boolean {
  return identifier.includes('@');
}

export async function signInWithPassword(input: {
  identifier: string;
  password: string;
}): Promise<void> {
  const identifier = input.identifier.trim();
  const result = isEmailAddress(identifier)
    ? await signIn.email({ email: identifier, password: input.password })
    : await signIn.username({ username: identifier, password: input.password });
  if (!result.error) return;
  const message = result.error.message ?? '';
  if (result.error.status === 403) throw new EmailNotConfirmedError(message);
  throw new Error(message);
}

// autoSignIn (set in @repo/auth) signs the user in right after sign-up. The display
// name is derived from the email; the planner does not use it yet. callbackURL is
// where the confirmation link lands when the instance sends one.
//
// On an invite-only instance the API rejects the sign-up unless the address has a
// pending project invite, and the thrown message says so.
export async function signUpWithEmail(input: { email: string; password: string }): Promise<void> {
  const result = await signUp.email({
    ...input,
    name: input.email.split('@')[0] || input.email,
    callbackURL: appUrl('/login?verified=1'),
  });
  if (result.error) throw new Error(result.error.message ?? '');
}

// Sends the password reset link. The address is not confirmed to exist: better-auth
// answers the same either way, so this never reveals who has an account.
//
// The address is carried in redirectTo so the reset screen can sign the user in once
// the new password is set: better-auth keeps the query it is given and adds its own
// `token` to it.
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const result = await requestPasswordReset({
    email,
    redirectTo: appUrl(`/reset-password?email=${encodeURIComponent(email)}`),
  });
  if (result.error) throw new Error(result.error.message ?? '');
}

// Consumes the token from the reset link, sets the new password, and signs the user
// in with it. The sign-in is best effort: an instance that requires a confirmed
// address refuses it, and the caller sends the reader to the sign-in screen instead.
export async function setNewPassword(input: {
  token: string;
  email: string;
  newPassword: string;
}): Promise<{ signedIn: boolean }> {
  const result = await resetPassword({ token: input.token, newPassword: input.newPassword });
  if (result.error) throw new Error(result.error.message ?? '');
  if (!input.email) return { signedIn: false };
  const attempt = await signIn.email({ email: input.email, password: input.newPassword });
  return { signedIn: !attempt.error };
}

// Sends a one-time sign-in link. Rejected by the API when the instance has magic
// links turned off.
export async function sendMagicLink(email: string): Promise<void> {
  const result = await signIn.magicLink({ email, callbackURL: appUrl('/') });
  if (result.error) throw new Error(result.error.message ?? '');
}

// Sends the address confirmation link again, for someone held back at sign-in.
export async function resendVerificationEmail(email: string): Promise<void> {
  const result = await sendVerificationEmail({
    email,
    callbackURL: appUrl('/login?verified=1'),
  });
  if (result.error) throw new Error(result.error.message ?? '');
}

// Drops the session created by autoSignIn right after sign-up, used when the
// instance requires a confirmed address: the account exists but must not be usable
// until the link in the email is opened.
export async function signOutUnverified(): Promise<void> {
  await signOut();
}

// Starts the Google round trip. Unlike every other call here this one navigates away
// instead of returning a result: better-auth redirects to Google, and Google comes
// back to the API callback, which then sends the browser to one of these two URLs.
// Both must be on the web origin — the handler runs on the API origin.
//
// It covers sign-up as well: an unknown address gets an account, subject to the
// instance registration mode, and a known one signs into the account it belongs to.
export async function signInWithGoogle(): Promise<void> {
  const result = await signIn.social({
    provider: 'google',
    callbackURL: appUrl('/'),
    errorCallbackURL: appUrl('/login'),
  });
  if (result.error) throw new Error(result.error.message ?? '');
}

// Starts the round trip through the instance's own OIDC provider. Same shape as the
// Google call above: it navigates away, and both callback URLs must be on the web
// origin. The provider id is fixed — the instance has exactly one.
export async function signInWithOidc(): Promise<void> {
  const result = await signIn.oauth2({
    providerId: 'oidc',
    callbackURL: appUrl('/'),
    errorCallbackURL: appUrl('/login'),
  });
  if (result.error) throw new Error(result.error.message ?? '');
}

export async function signInWithPasskey(): Promise<void> {
  const result = await signIn.passkey();
  if (result?.error) throw new Error(result.error.message ?? '');
}
