'use client';

import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import PageSkeleton from '@/components/common/skeleton/PageSkeleton';

// Scalar is a heavy client-only bundle: keep it out of the shared bundle and off
// the server.
const ScalarReference = dynamic(() => import('./components/ScalarReference'), {
  ssr: false,
  loading: () => <PageSkeleton rows={8} />,
});

// Mounted at /project/:projectKey/api, but the spec it renders is instance-wide.
export default function ApiDocsPage() {
  const { resolvedTheme } = useTheme();
  return <ScalarReference dark={resolvedTheme !== 'light'} />;
}
