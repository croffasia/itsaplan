'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getSharedView } from '@/lib/api/endpoints/share';
import { ApiError } from '@/lib/api/core/client';
import PublicShareFrame from '@/components/common/page/PublicShareFrame';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import ReadOnlyBoard from './components/public/ReadOnlyBoard';
import PublicIssueOverlay from './components/public/PublicIssueOverlay';

// The public read-only page for a shared saved view (/share/view/:token). Fetches
// the board bundle by token and renders it with no session; clicking an issue opens
// its read-only detail under the same token.
export default function PublicBoardPage({ token }: { token: string }) {
  const t = useTranslations('workItems.share');
  const params = useSearchParams();
  const [openIssueId, setOpenIssueId] = useState<number | null>(() => {
    const id = Number(params.get('issue'));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  });
  const query = useQuery({
    queryKey: ['share', 'view', token],
    queryFn: () => getSharedView(token),
    retry: false,
  });

  if (query.isLoading) {
    return (
      <PublicShareFrame>
        <div className="flex gap-4 overflow-hidden p-6">
          {Array.from({ length: 4 }, (_, i) => (
            <ListSkeleton key={i} rows={3} className="w-72 shrink-0" rowClassName="h-24" />
          ))}
        </div>
      </PublicShareFrame>
    );
  }

  if (
    !query.data ||
    (query.error instanceof ApiError && [401, 403, 404].includes(query.error.status))
  ) {
    return (
      <PublicShareFrame>
        <p className="px-6 py-10 text-sm text-muted-foreground">{t('boardUnavailable')}</p>
      </PublicShareFrame>
    );
  }

  return (
    <PublicShareFrame>
      <ReadOnlyBoard
        bundle={query.data}
        onOpenIssue={setOpenIssueId}
        token={token}
        overlayOpen={openIssueId != null}
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
      <PublicIssueOverlay
        token={token}
        issueId={openIssueId}
        extended={query.data.view.extended}
        onOpenIssue={setOpenIssueId}
        onClose={() => setOpenIssueId(null)}
      />
    </PublicShareFrame>
  );
}
