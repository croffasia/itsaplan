'use client';

import { useParams, useRouter } from 'next/navigation';
import { useShell } from '@/context/shellContext';
import { projectPath } from '@/utils/paths';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import { useIssueBySeqQuery } from '@/services/issues.service';
import IssueDetailContent from './components/detail/IssueDetailContent';

// The full-page issue view (/project/:projectKey/issue/:sequenceNumber), rendered
// inside the Shell layout. The URL carries the project-scoped number, resolved to
// the issue here; the project comes from the Shell. Escape returns to the work
// items view.
export default function IssueViewPage() {
  const router = useRouter();
  const params = useParams();
  const { project } = useShell();
  const seq = Number(typeof params.issueId === 'string' ? params.issueId : NaN);

  const exit = () => project && router.push(projectPath(project.project.key));
  useExitOnEscape(exit);

  const issueQuery = useIssueBySeqQuery(
    project?.project.key ?? null,
    Number.isNaN(seq) ? null : seq,
  );

  if (!project) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col px-8 py-6 xl:px-12">
        {issueQuery.data ? (
          <IssueDetailContent
            project={project}
            issueId={issueQuery.data.id}
            layout="page"
            onDeleted={exit}
          />
        ) : (
          <div className="py-6 text-sm text-muted-foreground">
            {issueQuery.isLoading ? 'Loading…' : 'Issue not found.'}
          </div>
        )}
      </div>
    </div>
  );
}
