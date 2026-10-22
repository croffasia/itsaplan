import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { splitProjectRef } from '@/utils/paths';

export function runIssueKey(run: RunnerQueueRun): string | null {
  if (run.sequenceNumber == null) return null;
  return `${splitProjectRef(run.projectRef).key}-${run.sequenceNumber}`;
}
