import { request } from '@/lib/api/core/client';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';

// One write tool call of an agent. `error` is the route's answer when it failed;
// `runId` names the queued run that made it, null for a chat; `approvedBy*` is the
// member who approved a held call.
export interface AgentAction {
  id: number;
  tool: string;
  args: Record<string, unknown>;
  status: 'success' | 'failed';
  error: string | null;
  projectId: number;
  issueId: number | null;
  issueKey: string | null;
  issueTitle: string | null;
  runId: number | null;
  approvedByUserId: string | null;
  approvedByName: string | null;
  createdAt: string;
}

// ISO date-times; `to` is exclusive.
export interface AgentActionRange {
  from?: string;
  to?: string;
}

export type PendingActionStatus =
  'pending' | 'applying' | 'approved' | 'rejected' | 'failed' | 'expired';

// A mutating tool call of an agent that requires approval. `args` is the call as the
// agent made it; `result` is the route's answer once it was approved.
export interface PendingAction {
  id: number;
  agentId: number;
  agentName: string;
  projectId: number;
  issueId: number | null;
  runId: number | null;
  tool: string;
  args: Record<string, unknown>;
  status: PendingActionStatus;
  reason: string | null;
  result: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export const listAgentActions = (
  teamId: number,
  agentId: number,
  params: PageParams,
  range: AgentActionRange,
) =>
  request<Page<AgentAction>>(
    `/teams/${teamId}/ai-agents/${agentId}/actions${pageQuery(params, { ...range })}`,
  );

export const listPendingActions = (
  teamId: number,
  agentId: number,
  params: PageParams,
  status?: PendingActionStatus,
) =>
  request<Page<PendingAction>>(
    `/teams/${teamId}/ai-agents/${agentId}/pending-actions${pageQuery(params, { status })}`,
  );

export const listIssuePendingActions = (issueId: number) =>
  request<PendingAction[]>(`/issues/${issueId}/agent-actions`);

export const approvePendingAction = (actionId: number) =>
  request<PendingAction>(`/agent-actions/${actionId}/approve`, { method: 'POST' });

export const rejectPendingAction = (actionId: number, reason: string) =>
  request<PendingAction>(`/agent-actions/${actionId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

export const setAgentRequireApproval = (teamId: number, agentId: number, value: boolean) =>
  request<{ requireApproval: boolean }>(`/teams/${teamId}/ai-agents/${agentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ requireApproval: value }),
  });
