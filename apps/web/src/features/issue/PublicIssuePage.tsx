'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import PublicShareFrame from '@/components/common/page/PublicShareFrame';
import PublicShareHeader from '@/components/common/page/PublicShareHeader';
import ReadOnlyIssueDetail from './components/detail/ReadOnlyIssueDetail';

// The public read-only page for a shared issue (/share/issue/:token). Fetches the
// self-contained bundle by token and renders it with no session. A missing or
// revoked token shows a not-found message.
export default function PublicIssuePage({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ['share', 'issue', token],
    queryFn: () => api.getSharedIssue(token),
    retry: false,
  });

  if (query.isLoading) {
    return (
      <PublicShareFrame>
        <p className="px-6 py-10 text-sm text-muted-foreground">Loading…</p>
      </PublicShareFrame>
    );
  }

  if (query.isError || !query.data) {
    return (
      <PublicShareFrame>
        <p className="px-6 py-10 text-sm text-muted-foreground">
          This shared issue is not available. The link may have been revoked.
        </p>
      </PublicShareFrame>
    );
  }

  return (
    <PublicShareFrame>
      <PublicShareHeader
        name={query.data.project.project.name}
        ticker={query.data.project.project.key}
      />
      <ReadOnlyIssueDetail bundle={query.data} />
    </PublicShareFrame>
  );
}
