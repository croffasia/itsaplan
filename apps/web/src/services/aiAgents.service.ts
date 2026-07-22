// An agent is also an assignee, so writes here invalidate the project detail as
// well, keeping the assignee picker in sync.

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { qk } from '@/services/queryKeys';
import { useInvalidateProject } from '@/services/projects.service';

export function useAiAgentsQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.aiAgents(projectKey ?? ''),
    queryFn: () => api.listAiAgents(projectKey!),
    enabled: projectKey != null,
  });
}

// An agent's triggered run history for the runs sidebar, paginated 25 at a time. Only
// fetched when agentId is set, so the query runs when the sidebar opens.
export function useAgentRuns(projectKey: string | null, agentId: number | null) {
  return useInfiniteQuery({
    queryKey: qk.agentRuns(projectKey ?? '', agentId ?? 0),
    queryFn: ({ pageParam }) => api.listAgentRuns(projectKey!, agentId!, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: projectKey != null && agentId != null,
  });
}

// The caller's chat threads with one agent (the AI Chat history rail), newest
// first. Only fetched when an agent is selected.
export function useAgentThreadsQuery(projectKey: string | null, agentId: number | null) {
  return useQuery({
    queryKey: qk.agentThreads(projectKey ?? '', agentId ?? 0),
    queryFn: () => api.listAiAgentThreads(projectKey!, agentId!),
    enabled: projectKey != null && agentId != null,
  });
}

// The transcript of one chat thread, to restore the conversation when a thread is
// opened. Only fetched when a thread is selected.
export function useAgentThreadMessagesQuery(
  projectKey: string | null,
  agentId: number | null,
  threadId: string | null,
) {
  return useInfiniteQuery({
    queryKey: qk.agentThreadMessages(projectKey ?? '', agentId ?? 0, threadId ?? ''),
    queryFn: ({ pageParam }) =>
      api.getAiAgentThreadMessages(projectKey!, agentId!, threadId!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextPage ?? undefined,
    enabled: projectKey != null && agentId != null && threadId != null,
  });
}

// The capability-tool catalog for the internal-agent form. Static per project, so
// it stays fresh for the session.
export function useAgentToolsQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.agentTools(projectKey ?? ''),
    queryFn: () => api.listAgentTools(projectKey!),
    enabled: projectKey != null,
    staleTime: Infinity,
  });
}

export function useCreateAiAgent(projectKey: string | null) {
  const qc = useQueryClient();
  const invalidateProject = useInvalidateProject(projectKey);
  return useMutation({
    mutationFn: (input: Parameters<typeof api.createAiAgent>[1]) =>
      api.createAiAgent(projectKey!, input),
    onSuccess: (res) => {
      toast.success(`Agent @${res.agent.username} created`);
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.aiAgents(projectKey) });
      invalidateProject();
    },
  });
}

export function useUpdateAiAgent(projectKey: string | null) {
  const qc = useQueryClient();
  const invalidateProject = useInvalidateProject(projectKey);
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof api.updateAiAgent>[2] }) =>
      api.updateAiAgent(projectKey!, id, patch),
    onSuccess: (agent) => {
      toast.success(`Agent @${agent.username} saved`);
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.aiAgents(projectKey) });
      invalidateProject();
    },
  });
}

export function useRegenerateAiAgentKey(projectKey: string | null) {
  return useMutation({
    mutationFn: (id: number) => api.regenerateAiAgentKey(projectKey!, id),
  });
}

export function useDeleteAiAgent(projectKey: string | null) {
  const qc = useQueryClient();
  const invalidateProject = useInvalidateProject(projectKey);
  return useMutation({
    mutationFn: (id: number) => api.deleteAiAgent(projectKey!, id),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.aiAgents(projectKey) });
      invalidateProject();
    },
  });
}
