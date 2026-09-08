// The team's configured tools, and the tools enabled on one of its agents. Both belong
// to the team, so every hook here is keyed by it. The tool catalog they are built from
// lives in integrations.service.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type NewConfiguredToolInput,
  listConfiguredToolOptions,
  listConfiguredTools,
  createConfiguredTool,
  deleteConfiguredTool,
  listAgentToolLinks,
  setAgentTools,
} from '@/lib/api/endpoints/agentTools';
import type { PageParams } from '@/lib/api/core/paging';
import { qk } from '@/services/queryKeys';

// The whole list, which the agent editor's tool picker and the tool dialog need
// entire.
export function useConfiguredToolOptionsQuery(teamId: number | null) {
  return useQuery({
    queryKey: qk.configuredToolOptions(teamId ?? 0),
    queryFn: () => listConfiguredToolOptions(teamId!),
    enabled: teamId != null,
  });
}

// One page of the list, for the section that shows it.
export function useConfiguredToolsPageQuery(teamId: number | null, params: PageParams) {
  return useQuery({
    queryKey: qk.configuredToolPage(teamId ?? 0, params),
    queryFn: () => listConfiguredTools(teamId!, params),
    enabled: teamId != null,
    placeholderData: keepPreviousData,
  });
}

export function useCreateConfiguredTool(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewConfiguredToolInput) => createConfiguredTool(teamId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.configuredTools(teamId) });
      // The team list carries how many tools the team holds.
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}

export function useDeleteConfiguredTool(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteConfiguredTool(teamId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.configuredTools(teamId) });
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}

// The configured tools enabled on one agent (the agent editor's Tools section).
export function useAgentToolLinksQuery(teamId: number | null, agentId: number | null) {
  return useQuery({
    queryKey: qk.agentToolLinks(teamId ?? 0, agentId ?? 0),
    queryFn: () => listAgentToolLinks(teamId!, agentId!),
    enabled: teamId != null && agentId != null,
  });
}

export function useSetAgentTools(teamId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, agentToolIds }: { agentId: number; agentToolIds: number[] }) =>
      setAgentTools(teamId!, agentId, agentToolIds),
    onSuccess: (_data, { agentId }) => {
      if (teamId != null)
        void qc.invalidateQueries({ queryKey: qk.agentToolLinks(teamId, agentId) });
    },
  });
}
