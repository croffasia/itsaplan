import { request } from '@/lib/api/core/client';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';
import type { IssueAgentRun } from './issues';

export interface RunnerQueueRun extends IssueAgentRun {
  issueId: number | null;
  sequenceNumber: number | null;
  issueTitle: string | null;
  projectRef: string;
  runnerState: 'online' | 'offline' | 'never';
}

export type RunnerQueuePage = Page<RunnerQueueRun> & { queued: number; running: number };
export const getRunnerQueue = (params: PageParams & { runId?: number }) =>
  request<RunnerQueuePage>(
    `/agent-runs/queue${pageQuery(params, { runId: params.runId?.toString() })}`,
  );
