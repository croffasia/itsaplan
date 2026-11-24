'use client';

import { notFound } from 'next/navigation';

// A page at /p/<path> that anyone opens, signed in or not. A self-hosted instance has
// none; the hosted build serves pages of its own there, such as a public form.
export default function PublicPage(_props: { path: string[] }) {
  return notFound();
}
