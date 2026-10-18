import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { PageParams } from '@/lib/api/core/paging';
import {
  approvePendingAction,
  listAgentActions,
  listIssuePendingActions,
  listPendingActions,
  rejectPendingAction,
  setAgentRequireApproval,
  type AgentActionRange,
  type PendingActionStatus,
} from '@/lib/api/endpoints/agent-actions';

const keys = {
  all: ['agentActions'] as const,
  log: (teamId: number, agentId: number, params: PageParams, range: AgentActionRange) =>
    ['agentActions', 'log', teamId, agentId, params, range] as const,
  pending: (teamId: number, agentId: number, params: PageParams, status?: PendingActionStatus) =>
    ['agentActions', 'pending', teamId, agentId, params, status] as const,
  issue: (issueId: number) => ['agentActions', 'issue', issueId] as const,
};

export function useAgentActionsQuery(
  teamId: number,
  agentId: number,
  params: PageParams,
  range: AgentActionRange,
) {
  return useQuery({
    queryKey: keys.log(teamId, agentId, params, range),
    queryFn: () => listAgentActions(teamId, agentId, params, range),
  });
}

export function usePendingActionsQuery(
  teamId: number,
  agentId: number,
  params: PageParams,
  status?: PendingActionStatus,
) {
  return useQuery({
    queryKey: keys.pending(teamId, agentId, params, status),
    queryFn: () => listPendingActions(teamId, agentId, params, status),
  });
}

export function useIssuePendingActionsQuery(issueId: number) {
  return useQuery({
    queryKey: keys.issue(issueId),
    queryFn: () => listIssuePendingActions(issueId),
  });
}

// Approving applies the call, which can change the issue on screen, so the issue reads
// are refreshed with the lists.
export function useDecidePendingAction() {
  const qc = useQueryClient();
  const t = useTranslations('teams.agentActions');
  return useMutation({
    mutationFn: (decision: { actionId: number; reject?: string }) =>
      decision.reject != null
        ? rejectPendingAction(decision.actionId, decision.reject)
        : approvePendingAction(decision.actionId),
    onSuccess: (action) => {
      toast.success(
        action.status === 'approved'
          ? t('approved')
          : action.status === 'rejected'
            ? t('rejected')
            : t('failed'),
      );
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: ['issue'] });
      void qc.invalidateQueries({ queryKey: ['workItems'] });
    },
  });
}

export function useSetRequireApproval(teamId: number, agentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: boolean) => setAgentRequireApproval(teamId, agentId, value),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['aiAgents'] }),
  });
}
