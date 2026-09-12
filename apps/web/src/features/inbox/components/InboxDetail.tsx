'use client';

import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import IssueDetailContent from '@/features/issue/components/detail/IssueDetailContent';
import InboxDetailHeader from './InboxDetailHeader';

// The issue of the selected notification. On a narrow screen it takes the whole
// inbox and returns to the list through the back button; on a wide one it is the
// right pane next to the list.
export default function InboxDetail({
  project,
  issueId,
  issueSeq,
  isMobile,
  onBack,
  onDeleted,
}: {
  project: ProjectDetail;
  issueId: number;
  issueSeq: number;
  isMobile: boolean;
  onBack: () => void;
  onDeleted: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <InboxDetailHeader
        projectKey={project.project.key}
        issueSeq={issueSeq}
        isMobile={isMobile}
        onBack={onBack}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 xl:px-10">
        <IssueDetailContent
          project={project}
          issueId={issueId}
          layout={isMobile ? 'panel' : 'split'}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  );
}
