import { request } from '@/lib/api/core/client';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';
import type { IssueAgentRun, IssueAgentRunTrace } from './issues';

export interface RunnerQueuePerson {
  name: string;
  image: string | null;
}

export interface RunnerQueueRun extends IssueAgentRun {
  issueId: number | null;
  sequenceNumber: number | null;
  issueTitle: string | null;
  scheduleId: number | null;
  scheduleName: string | null;
  projectRef: string;
  document: { id: number; title: string } | null;
  // Where the run comes from: the person it works for, null for the project's own work; who
  // queued it or made the change that started it, null for a timed schedule; the run an agent
  // did that in, and the first run of that chain.
  initiator: RunInitiatorOption | null;
  startedBy: (RunnerQueuePerson & { agentUsername: string | null }) | null;
  parentRun: { id: number; projectRef: string } | null;
  rootRun: {
    id: number;
    projectRef: string;
    scheduleName: string | null;
    initiator: RunnerQueuePerson | null;
  } | null;
  canReadSteps: boolean;
  // Null for an internal agent, which runs in the api and has no runner.
  runnerState: 'push' | 'online' | 'offline' | 'never' | null;
  // What the last model call read and wrote; null when the agent reports no counts.
  inputTokens: number | null;
  outputTokens: number | null;
}

// The counts follow every filter but the state, so each state can show how many runs it holds.
export type RunnerQueuePage = Page<RunnerQueueRun> & {
  queued: number;
  running: number;
  failed: number;
};
export type RunInitiatorOption = RunnerQueuePerson & { id: string };
export interface RunProjectOption {
  id: number;
  name: string;
  ref: string;
}
// 'active' is the waiting and running runs.
export type RunnerQueueState = 'failed' | 'active';
export interface RunnerQueueFilter {
  state?: RunnerQueueState;
  q?: string;
  initiatorIds?: string[];
  projectIds?: number[];
}
// Where a run queue is read and opened: `api` is the path it is read under
// (`/projects/<ref>`, `/teams/<id>` or `/workspaces/<id>`), `path` the page that lists it.
export interface RunnerQueueScope {
  api: string;
  path: string;
  // A team's or a workspace's queue, whose runs come from several projects.
  acrossProjects?: boolean;
}

const listParam = (values: (string | number)[] | undefined) =>
  values?.length ? values.join(',') : undefined;

export const getRunnerQueue = (
  api: string,
  params: PageParams & RunnerQueueFilter & { runId?: number },
) =>
  request<RunnerQueuePage>(
    `${api}/agent-runs/queue${pageQuery(params, {
      runId: params.runId?.toString(),
      state: params.state,
      q: params.q,
      initiatorIds: listParam(params.initiatorIds),
      projectIds: listParam(params.projectIds),
    })}`,
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
// whoever runs the team read one without a role in the project. `attempt` picks a recorded
// attempt, oldest 1; the latest without it.
export const getInternalRunTrace = (runId: number, attempt?: number) =>
  request<IssueAgentRunTrace | null>(
    `/agent-runs/${runId}/internal-trace${attempt == null ? '' : `?attempt=${attempt}`}`,
  );

export const getRunInitiatorOptions = (api: string) =>
  request<RunInitiatorOption[]>(`${api}/agent-runs/initiators/options`);

export const getRunProjectOptions = (api: string) =>
  request<RunProjectOption[]>(`${api}/agent-runs/projects/options`);
