'use client';

import { useParams } from 'next/navigation';
import { PublicPage } from '@/cloud';

// A page a build serves to anyone, signed in or not; this one serves none.
export default function Page() {
  const { path } = useParams<{ path: string[] }>();
  return <PublicPage path={path} />;
}
