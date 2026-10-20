'use client';

import { useParams } from 'next/navigation';
import { SignInPage } from '@/cloud';

// A sign-in page under a name of its own, which a build may serve; this one has none.
export default function Page() {
  const params = useParams();
  return <SignInPage name={typeof params.name === 'string' ? params.name : ''} />;
}
