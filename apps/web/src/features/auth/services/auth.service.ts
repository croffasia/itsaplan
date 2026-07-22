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
// is set and the middleware lets the user into the planner.

const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Sign-in was refused because the address is not confirmed yet. The only 403 the
// sign-in endpoint raises is the verification gate in @repo/auth, so the status is
// enough to tell it apart from wrong credentials and offer the link again.
export class EmailNotConfirmedError extends Error {}

export async function signInWithEmail(input: { email: string; password: string }): Promise<void> {
  const result = await signIn.email(input);
  if (!result.error) return;
  const message = result.error.message ?? GENERIC_ERROR;
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
  if (result.error) throw new Error(result.error.message ?? GENERIC_ERROR);
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
  if (result.error) throw new Error(result.error.message ?? GENERIC_ERROR);
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
  if (result.error) throw new Error(result.error.message ?? GENERIC_ERROR);
  if (!input.email) return { signedIn: false };
  const attempt = await signIn.email({ email: input.email, password: input.newPassword });
  return { signedIn: !attempt.error };
}

// Sends a one-time sign-in link. Rejected by the API when the instance has magic
// links turned off.
export async function sendMagicLink(email: string): Promise<void> {
  const result = await signIn.magicLink({ email, callbackURL: appUrl('/') });
  if (result.error) throw new Error(result.error.message ?? GENERIC_ERROR);
}

// Sends the address confirmation link again, for someone held back at sign-in.
export async function resendVerificationEmail(email: string): Promise<void> {
  const result = await sendVerificationEmail({
    email,
    callbackURL: appUrl('/login?verified=1'),
  });
  if (result.error) throw new Error(result.error.message ?? GENERIC_ERROR);
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
  if (result.error) throw new Error(result.error.message ?? GENERIC_ERROR);
}

export async function signInWithPasskey(): Promise<void> {
  const result = await signIn.passkey();
  if (result?.error)
    throw new Error(
      result.error.message ?? 'Could not sign in with your passkey. Please try again.',
    );
}
