'use client';

import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import SectionPageView from '@/components/common/page/SectionPageView';
import { Skeleton } from '@/components/ui/skeleton';
import LeadsErrorState from './components/LeadsErrorState';
import LeadsNav from './components/LeadsNav';
import LeadsAgentRunsTable from './components/runs/LeadsAgentRunsTable';
import { useLeadAgentRunsQuery } from './services/leads.service';

export default function LeadsAgentRunsPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';
  const runsQuery = useLeadAgentRunsQuery(projectKey);

  if (!project || runsQuery.isLoading) return <Skeleton className="m-6 flex-1" />;
  if (!can('leads', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to Leads.
      </div>
    );
  }
  if (runsQuery.isError) {
    return <LeadsErrorState onRetry={() => void runsQuery.refetch()} />;
  }

  const runs = runsQuery.data ?? [];
  return (
    <SectionPageView
      title="Agent Runs"
      description="Read-only sourcing and analysis progress from the lead system."
      wide
    >
      <LeadsNav projectKey={projectKey} />
      <div className="space-y-3 pb-8">
        <div>
          <h2 className="font-semibold">Run history</h2>
          <p className="text-sm text-muted-foreground">{runs.length} sourcing runs</p>
        </div>
        {runs.length > 0 ? (
          <LeadsAgentRunsTable runs={runs} />
        ) : (
          <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            No agent runs found.
          </p>
        )}
      </div>
    </SectionPageView>
  );
}
