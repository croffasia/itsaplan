'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { SharedIssueBundle } from '@/lib/api/endpoints/share';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import IssueDetailSkeleton from '../detail/IssueDetailSkeleton';
import ReadOnlyIssueDetail from '../detail/ReadOnlyIssueDetail';

// The read-only issue detail opened from a public share: a card of a shared board, or
// an issue a shared document names. `load` reads the issue under that share's token
// (the API checks the share reaches it) and the dialog renders it.
export default function PublicIssueOverlay({
  queryKey,
  load,
  issueId,
  extended,
  onOpenIssue,
  onClose,
}: {
  queryKey: readonly unknown[];
  load: (issueId: number) => Promise<SharedIssueBundle>;
  issueId: number | null;
  // Whether the board's link exposes the full issues; without it the bundle
  // carries no activity and no custom fields.
  extended: boolean;
  // Swaps the open issue for another one of the same share, so a subtask or the
  // other end of a relation opens in place.
  onOpenIssue: (id: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations('workItems.share');
  const query = useQuery({
    queryKey: [...queryKey, issueId],
    queryFn: () => load(issueId as number),
    enabled: issueId != null,
    retry: false,
  });
  const issue = issueId != null && !query.isError ? query.data?.issue : undefined;
  useDocumentTitle(issue ? `${issue.identifier} ${issue.title}` : null, 'panel');

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
