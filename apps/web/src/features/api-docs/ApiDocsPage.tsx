'use client';

import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api/core/client';
import PageSkeleton from '@/components/common/skeleton/PageSkeleton';
import { EmptyState } from '@/components/common/page/EmptyState';
import { useApiSpecQuery } from './services/apiDocs.service';

// Scalar is a heavy client-only bundle: keep it out of the shared bundle and off
// the server.
const ScalarReference = dynamic(() => import('./components/ScalarReference'), {
  ssr: false,
  loading: () => <PageSkeleton rows={8} />,
});

// Mounted at /:team/:projectKey/api, but the spec it renders is instance-wide.
export default function ApiDocsPage() {
  const t = useTranslations('nav');
  const { resolvedTheme } = useTheme();
  const spec = useApiSpecQuery();

  if (spec.error) {
    const hidden = spec.error instanceof ApiError && spec.error.status === 403;
    return (
      <EmptyState
        title={t(hidden ? 'apiDocsHidden' : 'apiDocsLoadFailed')}
        description={t(hidden ? 'apiDocsHiddenHint' : 'apiDocsLoadFailedHint')}
      />
    );
  }
  if (!spec.data) return <PageSkeleton rows={8} />;
  return <ScalarReference spec={spec.data} dark={resolvedTheme !== 'light'} />;
}
