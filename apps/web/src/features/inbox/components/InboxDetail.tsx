'use client';

import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import IssueDetailContent from '@/features/issue/components/detail/IssueDetailContent';
import IssueDetailSkeleton from '@/features/issue/components/detail/IssueDetailSkeleton';
import { useProjectQuery, useBoardIssuesQuery } from '@/services/projects.service';
import { useCycleOptionsQuery } from '@/services/cycles.service';
import { ShellCtx, useShell } from '@/context/shellContext';
import InboxDetailHeader from './InboxDetailHeader';

// The issue of the selected notification. On a narrow screen it takes the whole
// inbox and returns to the list through the back button; on a wide one it is the
// right pane next to the list.
export default function InboxDetail({
  project,
  projectKey,
  issueId,
  issueSeq,
  isMobile,
  onBack,
  onDeleted,
}: {
  project: ProjectDetail;
  projectKey: string;
  issueId: number;
  issueSeq: number;
  isMobile: boolean;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const shell = useShell();
  const foreignKey = projectKey === project.project.ref ? null : projectKey;
  const projectQuery = useProjectQuery(foreignKey);
  const boardQuery = useBoardIssuesQuery(foreignKey);
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
        issueSeq={issueSeq}
        isMobile={isMobile}
        onBack={onBack}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 xl:px-10">
        {detailProject ? (
          <ShellCtx.Provider value={{ ...shell, project: detailProject }}>
            <IssueDetailContent
              project={detailProject}
              issueId={issueId}
              layout={isMobile ? 'panel' : 'split'}
              onDeleted={onDeleted}
            />
          </ShellCtx.Provider>
        ) : projectQuery.error ? (
          <div className="py-6 text-sm text-muted-foreground">{projectQuery.error.message}</div>
        ) : (
          <IssueDetailSkeleton />
        )}
      </div>
    </div>
  );
}
