'use client';

import { useRouter } from 'next/navigation';
import { useShell } from '@/context/shellContext';
import { issuePath, projectPath } from '@/utils/paths';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import { useShellRoute } from '@/hooks/useShellRoute';
import { useHistoryScrollRestoration } from '@/hooks/useHistoryScrollRestoration';
import { useIssueBySeqQuery } from '@/services/issues.service';
import IssueDetailContent from './components/detail/IssueDetailContent';
import IssueDetailSkeleton from './components/detail/IssueDetailSkeleton';
import { useTranslations } from 'next-intl';

// The full-page issue view (/:team/issue/:identifier), rendered inside the Shell
// layout. The URL carries the issue identifier, resolved to the issue here; the
// project comes from the Shell. Escape returns to the work items view.
export default function IssueViewPage() {
  const t = useTranslations('issue');
  const router = useRouter();
  const { project } = useShell();
  const seq = useShellRoute().routeIssueSeq;

  const exit = () => project && router.push(projectPath(project.project.ref));
  useExitOnEscape(exit);

  const issueQuery = useIssueBySeqQuery(project?.project.ref ?? null, seq);
  const currentIssuePath = project && seq != null ? issuePath(project.project.ref, seq) : null;
  const scrollRestorationProps = useHistoryScrollRestoration({ pathname: currentIssuePath });

  if (!project) return null;

  return (
    <div {...scrollRestorationProps} className="flex-1 overflow-y-auto">
      <div className="flex flex-col px-8 py-6 xl:px-12">
        {issueQuery.data ? (
          <IssueDetailContent
            project={project}
            issueId={issueQuery.data.id}
            layout="page"
            onDeleted={exit}
          />
        ) : issueQuery.isLoading ? (
          <IssueDetailSkeleton />
        ) : (
          <div className="py-6 text-sm text-muted-foreground">{t('notFound')}</div>
        )}
      </div>
    </div>
  );
}
