import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { useExternalRunTraceQuery, useInternalRunTraceQuery } from '@/services/runnerQueue.service';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import { externalTraceParts } from '@/components/common/agent-runs/externalTraceParts';
import { internalTraceParts } from '@/components/common/agent-runs/internalTraceParts';

// The steps of the run's latest attempt, read through the same queries as its Steps tab,
// so the tab can say how many there are and whether one failed before it is opened.
export function useRunSteps(run: RunnerQueueRun) {
  const internal = run.kind === 'internal';
  const internalTrace = useInternalRunTraceQuery(run.id, undefined, internal && run.canReadSteps);
  const externalTrace = useExternalRunTraceQuery(run.id, undefined, !internal && run.canReadSteps);
  useLiveRefresh({
    scope: revScope.runnerQueue,
    targets: [internal ? qk.internalRunTrace(run.id) : qk.externalRunTrace(run.id)],
  });
  if (internal) {
    const detail = internalTrace.isError ? null : internalTrace.data;
    return detail ? internalTraceParts(detail.spans) : undefined;
  }
  const trace = externalTrace.isError ? null : externalTrace.data;
  return trace ? externalTraceParts(trace.events) : undefined;
}
