'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import PublicShareFrame from '@/components/common/page/PublicShareFrame';
import ReadOnlyBoard from './components/public/ReadOnlyBoard';
import PublicIssueOverlay from './components/public/PublicIssueOverlay';

// The public read-only page for a shared saved view (/share/view/:token). Fetches
// the board bundle by token and renders it with no session; clicking an issue opens
// its read-only detail under the same token.
export default function PublicBoardPage({ token }: { token: string }) {
  const [openIssueId, setOpenIssueId] = useState<number | null>(null);
  const query = useQuery({
    queryKey: ['share', 'view', token],
    queryFn: () => api.getSharedView(token),
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
          This shared board is not available. The link may have been revoked.
        </p>
      </PublicShareFrame>
    );
  }

  return (
    <PublicShareFrame>
      <ReadOnlyBoard bundle={query.data} onOpenIssue={setOpenIssueId} />
      <PublicIssueOverlay
        token={token}
        issueId={openIssueId}
        onClose={() => setOpenIssueId(null)}
      />
    </PublicShareFrame>
  );
}
