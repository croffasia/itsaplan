'use client';

import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Notification } from '@/lib/api/endpoints/notifications';
import DocumentView from '@/features/documents/components/DocumentView';
import IssueDetailContent from '@/features/issue/components/detail/IssueDetailContent';
import IssueDetailSkeleton from '@/features/issue/components/detail/IssueDetailSkeleton';
import { useProjectQuery, useBoardIssuesQuery } from '@/services/projects.service';
import { useCycleOptionsQuery } from '@/services/cycles.service';
import { ShellCtx, useShell } from '@/context/shellContext';
import InboxDetailHeader from './InboxDetailHeader';

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
  const shell = useShell();
  const projectKey = notification.projectRef;
  const foreignKey = projectKey === project.project.ref ? null : projectKey;
  const projectQuery = useProjectQuery(foreignKey);
  const boardQuery = useBoardIssuesQuery(notification.issueId != null ? foreignKey : null);
  const cyclesQuery = useCycleOptionsQuery(
    projectQuery.data?.project.cyclesEnabled ? foreignKey : null,
  );
  const detailProject: ProjectDetail | null = foreignKey
    ? projectQuery.data
      ? {
          ...projectQuery.data,
          issues: boardQuery.data?.issues ?? [],
          plannedCycles: cyclesQuery.data ?? [],
        }
      : null
    : project;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <InboxDetailHeader
        projectKey={projectKey}
        notification={notification}
        isMobile={isMobile}
        onBack={onBack}
      />
      {detailProject ? (
        <ShellCtx.Provider value={{ ...shell, project: detailProject }}>
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
                project={detailProject}
                issueId={notification.issueId!}
                layout={isMobile ? 'panel' : 'split'}
                onDeleted={onDeleted}
                commentId={notification.issueCommentId}
              />
            </div>
          )}
        </ShellCtx.Provider>
      ) : projectQuery.error ? (
        <div className="py-6 text-sm text-muted-foreground">{projectQuery.error.message}</div>
      ) : (
        <IssueDetailSkeleton />
      )}
    </div>
  );
}
