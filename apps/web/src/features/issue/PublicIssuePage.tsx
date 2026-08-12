'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import PublicShareFrame from '@/components/common/page/PublicShareFrame';
import PublicShareHeader from '@/components/common/page/PublicShareHeader';
import IssueDetailSkeleton from './components/detail/IssueDetailSkeleton';
import ReadOnlyIssueDetail from './components/detail/ReadOnlyIssueDetail';
import { useTranslations } from 'next-intl';

// The public read-only page for a shared issue (/share/issue/:token). Fetches the
// self-contained bundle by token and renders it with no session. A missing or
// revoked token shows a not-found message.
export default function PublicIssuePage({ token }: { token: string }) {
  const t = useTranslations('issue');
  const query = useQuery({
    queryKey: ['share', 'issue', token],
    queryFn: () => api.getSharedIssue(token),
    retry: false,
  });

  if (query.isLoading) {
    return (
      <PublicShareFrame>
        <div className="px-6 py-4">
          <IssueDetailSkeleton />
        </div>
      </PublicShareFrame>
    );
  }

  if (query.isError || !query.data) {
    return (
      <PublicShareFrame>
        <p className="px-6 py-10 text-sm text-muted-foreground">{t('shareUnavailable')}</p>
      </PublicShareFrame>
    );
  }

  return (
    <PublicShareFrame>
      <PublicShareHeader
        name={query.data.project.project.name}
        ticker={query.data.project.project.key}
      />
      <ReadOnlyIssueDetail bundle={query.data} extended={query.data.issue.shareExtended} />
    </PublicShareFrame>
  );
}
