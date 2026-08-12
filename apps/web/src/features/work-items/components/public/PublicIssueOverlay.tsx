'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import IssueDetailSkeleton from '@/features/issue/components/detail/IssueDetailSkeleton';
import ReadOnlyIssueDetail from '@/features/issue/components/detail/ReadOnlyIssueDetail';

// The read-only issue detail opened from a shared board card. It fetches the issue
// under the board's own share token (the API checks the issue belongs to the shared
// view's project) and renders it in a dialog. Composing the issue feature's
// read-only detail is the allowed work-items → issue direction.
export default function PublicIssueOverlay({
  token,
  issueId,
  extended,
  onOpenIssue,
  onClose,
}: {
  token: string;
  issueId: number | null;
  // Whether the board's link exposes the full issues; without it the bundle
  // carries no activity and no custom fields.
  extended: boolean;
  // Swaps the open issue for another one of the same board, so a subtask or the
  // other end of a relation opens in place.
  onOpenIssue: (id: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations('workItems.share');
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
          <DialogTitle>{t('issueTitle')}</DialogTitle>
        </DialogHeader>
        {query.isLoading && (
          <div className="px-8 py-2">
            <IssueDetailSkeleton />
          </div>
        )}
        {(query.isError || (!query.isLoading && !query.data)) && (
          <p className="p-8 text-sm text-muted-foreground">{t('issueUnavailable')}</p>
        )}
        {query.data && (
          <ReadOnlyIssueDetail bundle={query.data} extended={extended} onOpenIssue={onOpenIssue} />
        )}
      </DialogContent>
    </Dialog>
  );
}
