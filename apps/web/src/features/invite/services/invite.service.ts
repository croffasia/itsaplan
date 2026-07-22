// Data access for the public invite accept page. The invite endpoints and the
// auth client are both reached at the API origin, so the session cookie set by
// sign-in/sign-up is sent with the accept call that follows.

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { signIn, signUp } from '@/lib/auth-client';

export function useInviteQuery(token: string) {
  return useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.getInvite(token),
    // A bad token is a 404, not a transient failure — do not retry.
    retry: false,
  });
}

// An auth failure during the join flow, carrying better-auth's error code so the
// form can react — most importantly, switch to sign-in when the invited email
// already has an account (there is no public "email exists" check to do upfront).
export class InviteAuthError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'InviteAuthError';
  }
}

// True when a sign-up failed because the email already has an account.
export function isExistingAccountError(err: unknown): boolean {
  return (
    err instanceof InviteAuthError &&
    (err.code === 'USER_ALREADY_EXISTS' || /already\s*exist/i.test(err.message))
  );
}

// Create an account for the invited email, then accept. autoSignIn (set in
// @repo/auth) signs the new user in during sign-up, so the accept call that
// follows carries their session.
export async function registerAndAccept(input: { email: string; password: string; token: string }) {
  const result = await signUp.email({
    email: input.email,
    password: input.password,
    name: input.email.split('@')[0] || input.email,
  });
  if (result.error) {
    throw new InviteAuthError(
      result.error.message ?? 'Could not create your account.',
      result.error.code,
    );
  }
  return api.acceptInvite(input.token);
}

// Sign in to an existing account. Does not accept: after the session updates the
// page shows the accept/reject step for the invitee to decide.
export async function signInForInvite(input: { email: string; password: string }): Promise<void> {
  const result = await signIn.email({ email: input.email, password: input.password });
  if (result.error) {
    throw new InviteAuthError(result.error.message ?? 'Could not sign you in.', result.error.code);
  }
}
