import type { ReactNode } from 'react';

// Named by its message under `issue.agentRuns.facts`.
export type RunFactKey =
  | 'status'
  | 'canceledBy'
  | 'agent'
  | 'trigger'
  | 'workItem'
  | 'document'
  | 'schedule'
  | 'project'
  | 'runner'
  | 'delivery'
  | 'run'
  | 'initiator'
  | 'startedBy'
  | 'fromRun'
  | 'firstRun'
  | 'created'
  | 'started'
  | 'finished'
  | 'duration'
  | 'attempts'
  | 'context';

export type RunFact = [key: RunFactKey, value: ReactNode];
