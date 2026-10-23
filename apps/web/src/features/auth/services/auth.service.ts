import {
  signIn,
  signUp,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
} from '@/lib/auth-client';

// Where a link in an email lands the reader. The auth handler runs on the API
// origin, so every link it builds needs the web origin passed in explicitly —
// without it better-auth sends the reader back to the API, which renders nothing.
const appUrl = (path: string) =>
  typeof window === 'undefined' ? path : `${window.location.origin}${path}`;

// Each call throws an AuthError on failure; on success the session cookie is set and
// the proxy lets the user into the planner. The caller words the failure by its code
// and status, since the server's message is English.

// A refusal from the auth server, with better-auth's code and the HTTP status.
export class AuthError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// Sign-in was refused because the address is not confirmed yet. The verification gate
// in @repo/auth answers 403 with this code, as better-auth does; a deactivated account
// and a disabled password form are 403s too, and must not offer the link again.
export class EmailNotConfirmedError extends AuthError {}

export function authError(error: { message?: string; code?: string; status?: number }): AuthError {
  const { message = '', code, status } = error;
  return code === 'EMAIL_NOT_VERIFIED'
    ? new EmailNotConfirmedError(message, code, status)
    : new AuthError(message, code, status);
}

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
  if (result.error) throw authError(result.error);
}

// autoSignIn (set in @repo/auth) signs the user in right after sign-up, unless the
// instance requires a confirmed address, in which case no session is opened. The
// display name is derived from the email; the planner does not use it yet.
// callbackURL is where the confirmation link lands when the instance sends one.
//
// On an invite-only instance the API rejects the sign-up unless the address has a
// pending project invite, with a code the form words.
export async function signUpWithEmail(input: { email: string; password: string }): Promise<void> {
  const result = await signUp.email({
    ...input,
    name: input.email.split('@')[0] || input.email,
    callbackURL: appUrl('/login?verified=1'),
  });
  if (result.error) throw authError(result.error);
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
  if (result.error) throw authError(result.error);
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
  if (result.error) throw authError(result.error);
  if (!input.email) return { signedIn: false };
  const attempt = await signIn.email({ email: input.email, password: input.newPassword });
  return { signedIn: !attempt.error };
}

// Sends a one-time sign-in link. Rejected by the API when the instance has magic
// links turned off.
export async function sendMagicLink(email: string): Promise<void> {
  // A refused sign-up comes back to errorCallbackURL; on / it would be lost in the
  // redirect to the sign-in page.
  const result = await signIn.magicLink({
    email,
    callbackURL: appUrl('/'),
    errorCallbackURL: appUrl('/login'),
  });
  if (result.error) throw authError(result.error);
}

// Sends the address confirmation link again, for someone held back at sign-in.
export async function resendVerificationEmail(email: string): Promise<void> {
  const result = await sendVerificationEmail({
    email,
    callbackURL: appUrl('/login?verified=1'),
  });
  if (result.error) throw authError(result.error);
}

// Starts the Google round trip. Unlike every other call here this one navigates away
// instead of returning a result: better-auth redirects to Google, and Google comes
// back to the API callback, which then sends the browser to one of these two URLs.
// Both must be on the web origin — the handler runs on the API origin. `returnTo` is a
// web path both lead to instead, the invite screen for an invitee.
//
// It covers sign-up as well: an unknown address gets an account, subject to the
// instance registration mode, and a known one signs into the account it belongs to.
export async function signInWithGoogle(returnTo?: string): Promise<void> {
  const result = await signIn.social({
    provider: 'google',
    callbackURL: appUrl(returnTo ?? '/'),
    errorCallbackURL: appUrl(returnTo ?? '/login'),
  });
  if (result.error) throw authError(result.error);
}

// Starts the round trip through the instance's own OIDC provider. Same shape as the
// Google call above: it navigates away, and both callback URLs must be on the web
// origin. The provider id is fixed — the instance has exactly one.
export async function signInWithOidc(returnTo?: string): Promise<void> {
  const result = await signIn.social({
    provider: 'oidc',
    callbackURL: appUrl(returnTo ?? '/'),
    errorCallbackURL: appUrl(returnTo ?? '/login'),
  });
  if (result.error) throw authError(result.error);
}

export async function signInWithPasskey(): Promise<void> {
  const result = await signIn.passkey();
  if (result?.error) throw authError(result.error);
}
