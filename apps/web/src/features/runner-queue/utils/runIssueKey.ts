import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { splitProjectRef } from '@/utils/paths';

export function runIssueKey(run: RunnerQueueRun): string | null {
  if (run.sequenceNumber == null) return null;
  return `${splitProjectRef(run.projectRef).key}-${run.sequenceNumber}`;
}

// What a list names the run by: its issue's key, or, in a queue over several projects,
// the project of a run on no issue.
export function runPlace(run: RunnerQueueRun, acrossProjects: boolean): string | null {
  return runIssueKey(run) ?? (acrossProjects ? splitProjectRef(run.projectRef).key : null);
}
