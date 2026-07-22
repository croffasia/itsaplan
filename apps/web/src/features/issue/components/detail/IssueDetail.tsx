import { useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { type ProjectDetail, type IssueDetail as IssueDetailRow } from '@/lib/api';
import IssueDetailContent from './IssueDetailContent';
import IssueActionsBar from '../actions/IssueActionsBar';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import { Button } from '@/components/ui/button';

// The issue detail as a right-hand side panel over the project. Expand opens the
// same issue as a full page; the shared body lives in IssueDetailContent.
export default function IssueDetail({
  project,
  issueId,
  onClose,
  onExpand,
}: {
  project: ProjectDetail;
  issueId: number;
  onClose: () => void;
  // Passed the issue's project-scoped number so the host can open the page URL
  // (/project/KEY/issue/42); null while the issue is still loading.
  onExpand: (sequenceNumber: number | null) => void;
}) {
  const [issue, setIssue] = useState<IssueDetailRow | null>(null);

  useExitOnEscape(onClose);

  return (
    <div
      className="fixed inset-0 z-40 flex"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* No padding at the top: the sticky header carries it, so it can sit flush
          against the panel edge with nothing showing above it. */}
      <div className="ml-auto flex h-full w-full flex-col overflow-y-auto border-l bg-card px-5 pt-0 pb-5 sm:w-[720px] sm:max-w-[92vw] sm:px-8">
        {/* The header stays at the top while the body scrolls under it. Negative
            margins cancel the panel padding so its translucent, blurred backdrop
            spans the full panel width. */}
        <div className="sticky top-0 z-10 -mx-5 mb-3 flex items-center justify-between gap-2 bg-card/85 px-5 pt-5 pb-3 backdrop-blur-md sm:-mx-8 sm:px-8">
          <span className="text-xs text-muted-foreground">{issue?.identifier ?? ''}</span>
          <div className="flex items-center gap-1">
            {issue && (
              <>
                <IssueActionsBar
                  project={project}
                  issue={issue}
                  hasSidebar={false}
                  variant="header"
                  onDeleted={onClose}
                />
                <div className="mx-1 h-5 w-px bg-border" />
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={() => onExpand(issue?.sequenceNumber ?? null)}
              title="Open as page"
            >
              <Maximize2 />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={onClose} title="Close">
              <X />
            </Button>
          </div>
        </div>

        <IssueDetailContent
          project={project}
          issueId={issueId}
          onIssueLoaded={setIssue}
          onDeleted={onClose}
        />
      </div>
    </div>
  );
}
