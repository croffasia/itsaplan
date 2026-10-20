'use client';

// Among the sign-in methods, after the instance's own provider, and on the invite screen,
// where `email` is the invited address. A self-hosted instance adds nothing; the hosted
// build offers a sign-in through providers of its own.
export default function SignInExtras(_props: { pending: boolean; email?: string }) {
  return null;
}
