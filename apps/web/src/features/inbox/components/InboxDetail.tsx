'use client';

import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Notification } from '@/lib/api/endpoints/notifications';
import DocumentView from '@/features/documents/components/DocumentView';
import IssueDetailContent from '@/features/issue/components/detail/IssueDetailContent';
import InboxDetailHeader from './InboxDetailHeader';

// The issue or the document of the selected notification. On a narrow screen it takes
// the whole inbox and returns to the list through the back button; on a wide one it is
// the right pane next to the list. A mention in a document comment opens its comments.
export default function InboxDetail({
  project,
  notification,
  isMobile,
  onBack,
  onDeleted,
}: {
  project: ProjectDetail;
  notification: Notification;
  isMobile: boolean;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const projectKey = project.project.ref;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <InboxDetailHeader
        projectKey={projectKey}
        notification={notification}
        isMobile={isMobile}
        onBack={onBack}
      />
      {notification.documentId != null ? (
        <div className="flex min-h-0 flex-1">
          <DocumentView
            projectKey={projectKey}
            documentId={notification.documentId}
            defaultCommentsOpen={notification.documentCommentId != null}
            onDeleted={onDeleted}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 xl:px-10">
          <IssueDetailContent
            project={project}
            issueId={notification.issueId!}
            layout={isMobile ? 'panel' : 'split'}
            onDeleted={onDeleted}
            commentId={notification.issueCommentId}
          />
        </div>
      )}
    </div>
  );
}
