import { useTranslations } from 'next-intl';
import type { RunnerQueueRun, RunnerQueueScope } from '@/lib/api/endpoints/runnerQueue';
import { useRunsInFlightQuery } from '@/services/runnerQueue.service';
import { runPath } from '../utils/runPath';
import RunnerQueueActiveCard from './RunnerQueueActiveCard';
import RunnerQueueOfflineNotice from './RunnerQueueOfflineNotice';

// The runs that wait or work, with how many internal agents work in the workspace.
export default function RunnerQueueActive({
  scope,
  runs,
  selectedId,
}: {
  scope: RunnerQueueScope;
  runs: RunnerQueueRun[];
  selectedId: number | null;
}) {
  const t = useTranslations('issue.agentRuns');
  const inFlight = useRunsInFlightQuery(scope.api).data;
  if (runs.length === 0) return null;

  return (
    <section>
      <div className="flex flex-wrap justify-between gap-x-3 px-4 pt-2 pb-1.5 text-xs text-muted-foreground">
        <h3 className="font-semibold">{t('activeSection')}</h3>
        {inFlight && (
          <span>
            {inFlight.limit > 0
              ? t('internalInFlight', { running: inFlight.running, limit: inFlight.limit })
              : t('internalInFlightNoLimit', { running: inFlight.running })}
          </span>
        )}
      </div>
      <RunnerQueueOfflineNotice runs={runs} />
      <div className="space-y-2 px-3 pt-1">
        {runs.map((run) => (
          <RunnerQueueActiveCard
            key={run.id}
            run={run}
            href={runPath(run, scope.path)}
            selected={run.id === selectedId}
            acrossProjects={scope.acrossProjects ?? false}
          />
        ))}
      </div>
    </section>
  );
}
