import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { usePermissions } from '@/hooks/usePermissions';
import { useRunningRunsQuery } from '@/services/runnerQueue.service';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';

// How many agent runs work in the project now, kept live.
export function useRunningRuns(project: ProjectDetail | null): number {
  const { can } = usePermissions(project);
  const ref = project?.project.ref ?? '';
  const enabled = project != null && can('ai_agents', 'read');
  const count = useRunningRunsQuery(ref, enabled).data ?? 0;
  // A run that loses its lease stops counting without a write, which only the queue's
  // marker shows. The project's own marker is one row of the shared read, so it is what
  // an idle project is watched by.
  useLiveRefresh({
    scope: project && count === 0 ? revScope.agentRuns(project.project.id) : revScope.runnerQueue,
    targets: [qk.runningRuns(ref)],
    enabled,
  });
  return count;
}
