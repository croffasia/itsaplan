'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ReadOnlyIssueDetail from '@/features/issue/components/detail/ReadOnlyIssueDetail';

// The read-only issue detail opened from a shared board card. It fetches the issue
// under the board's own share token (the API checks the issue belongs to the shared
// view's project) and renders it in a dialog. Composing the issue feature's
// read-only detail is the allowed work-items → issue direction.
export default function PublicIssueOverlay({
  token,
  issueId,
  onClose,
}: {
  token: string;
  issueId: number | null;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ['share', 'view', token, 'issue', issueId],
    queryFn: () => api.getSharedViewIssue(token, issueId as number),
    enabled: issueId != null,
    retry: false,
  });

  return (
    <Dialog open={issueId != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="fixed inset-0 top-0 left-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-0 p-0 sm:max-w-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Issue</DialogTitle>
        </DialogHeader>
        {query.isLoading && <p className="p-8 text-sm text-muted-foreground">Loading…</p>}
        {(query.isError || (!query.isLoading && !query.data)) && (
          <p className="p-8 text-sm text-muted-foreground">This issue is not available.</p>
        )}
        {query.data && <ReadOnlyIssueDetail bundle={query.data} layout="page" />}
      </DialogContent>
    </Dialog>
  );
}
