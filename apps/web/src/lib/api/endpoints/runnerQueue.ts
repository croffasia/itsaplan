import { request } from '@/lib/api/core/client';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';
import type { IssueAgentRun, IssueAgentRunTrace } from './issues';

export interface RunnerQueueRun extends IssueAgentRun {
  issueId: number | null;
  sequenceNumber: number | null;
  issueTitle: string | null;
  scheduleName: string | null;
  projectRef: string;
  // Null for an internal agent, which runs in the api and has no runner.
  runnerState: 'push' | 'online' | 'offline' | 'never' | null;
}

export type RunnerQueuePage = Page<RunnerQueueRun> & { queued: number; running: number };
// Where a run queue is read and opened: `api` is the path it is read under
// (`/projects/<ref>`, `/teams/<id>` or `/workspaces/<id>`), `path` the page that lists it.
export interface RunnerQueueScope {
  api: string;
  path: string;
  // A team's or a workspace's queue, whose runs come from several projects.
  acrossProjects?: boolean;
}

export const getRunnerQueue = (api: string, params: PageParams & { runId?: number }) =>
  request<RunnerQueuePage>(
    `${api}/agent-runs/queue${pageQuery(params, { runId: params.runId?.toString() })}`,
  );

// Runs of internal agents in flight in the scope's workspace, and the workspace's limit on
// them; 0 when it has none.
export interface RunsInFlight {
  running: number;
  limit: number;
}

export const getRunsInFlight = (api: string) =>
  request<RunsInFlight>(`${api}/agent-runs/in-flight`);

// An internal run's trace, read by the run alone: it opens a run on no issue, and lets
// whoever runs the team read one without a role in the project.
export const getInternalRunTrace = (runId: number, traceId?: string) =>
  request<IssueAgentRunTrace | null>(
    `/agent-runs/${runId}/internal-trace${traceId == null ? '' : `?traceId=${encodeURIComponent(traceId)}`}`,
  );
