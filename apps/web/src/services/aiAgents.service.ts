// An agent is also an assignee, so writes here invalidate the project detail as
// well, keeping the assignee picker in sync.

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { api, type AiChatThreadPage } from '@/lib/api';
import { qk } from '@/services/queryKeys';
import { useInvalidateProject } from '@/services/projects.service';

// Refetched on an interval because an external agent's runner presence comes from
// this list: without it the online/offline state stays at whatever it was when the
// settings page opened.
const RUNNER_PRESENCE_REFRESH_MS = 30_000;

export function useAiAgentsQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.aiAgents(projectKey ?? ''),
    queryFn: () => api.listAiAgents(projectKey!),
    enabled: projectKey != null,
    refetchInterval: RUNNER_PRESENCE_REFRESH_MS,
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

// The caller's chat threads with one agent (the chat history), newest first and a
// page at a time. Only fetched when an agent is selected.
export function useAgentThreadsQuery(projectKey: string | null, agentId: number | null) {
  return useInfiniteQuery({
    queryKey: qk.agentThreads(projectKey ?? '', agentId ?? 0),
    queryFn: ({ pageParam }) => api.listAiAgentThreads(projectKey!, agentId!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextPage ?? undefined,
    enabled: projectKey != null && agentId != null,
  });
}

// The threads loaded so far, as one list. The pages the history has not reached are
// simply not in it: a tab of an older conversation falls back to its default title.
export function useLoadedAgentThreads(projectKey: string | null, agentId: number | null) {
  const query = useAgentThreadsQuery(projectKey, agentId);
  return query.data?.pages.flatMap((page) => page.items) ?? [];
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

// Renames one of the caller's chat threads. The new title is put into the loaded
// history right away: it is what the tab of that conversation is called.
export function useRenameAgentThread(projectKey: string | null, agentId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, title }: { threadId: string; title: string }) =>
      api.renameAiAgentThread(projectKey!, agentId!, threadId, title),
    onSuccess: (_res, { threadId, title }) => {
      if (!projectKey || agentId == null) return;
      qc.setQueryData<InfiniteData<AiChatThreadPage>>(
        qk.agentThreads(projectKey, agentId),
        (prev) =>
          prev && {
            ...prev,
            pages: prev.pages.map((page) => ({
              ...page,
              items: page.items.map((thread) =>
                thread.id === threadId ? { ...thread, title } : thread,
              ),
            })),
          },
      );
    },
  });
}

// Deletes one of the caller's chat threads with an agent and refreshes the history
// list it was in.
export function useDeleteAgentThread(projectKey: string | null, agentId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => api.deleteAiAgentThread(projectKey!, agentId!, threadId),
    onSuccess: () => {
      if (projectKey && agentId != null)
        void qc.invalidateQueries({ queryKey: qk.agentThreads(projectKey, agentId) });
    },
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
  const t = useTranslations('settings.agents');
  const qc = useQueryClient();
  const invalidateProject = useInvalidateProject(projectKey);
  return useMutation({
    mutationFn: (input: Parameters<typeof api.createAiAgent>[1]) =>
      api.createAiAgent(projectKey!, input),
    onSuccess: (res) => {
      toast.success(t('created', { username: res.agent.username }));
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.aiAgents(projectKey) });
      invalidateProject();
    },
  });
}

export function useUpdateAiAgent(projectKey: string | null) {
  const t = useTranslations('settings.agents');
  const qc = useQueryClient();
  const invalidateProject = useInvalidateProject(projectKey);
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof api.updateAiAgent>[2] }) =>
      api.updateAiAgent(projectKey!, id, patch),
    onSuccess: (agent) => {
      toast.success(t('saved', { username: agent.username }));
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.aiAgents(projectKey) });
      invalidateProject();
    },
  });
}

export function useRegenerateAiAgentKey(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.regenerateAiAgentKey(projectKey!, id),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.aiAgents(projectKey) });
    },
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
