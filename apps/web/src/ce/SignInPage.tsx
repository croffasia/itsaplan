'use client';

import { notFound } from 'next/navigation';

// A sign-in page of its own at /login/<name>. A self-hosted instance has none; the hosted
// build shows the sign-in of a workspace there.
export default function SignInPage(_props: { name: string }) {
  return notFound();
}
