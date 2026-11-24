// An agent belongs to a team, so the hooks that manage one are keyed by the team. Its
// chat history stays keyed by the project, where a conversation is held. An agent is
// also an assignee, so writes here invalidate the project detail as well, keeping the
// assignee picker in sync.

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  type AiChatThread,
  type AiChatThreadPage,
  listChatThreads,
  listFavoriteChatThreads,
  setAiAgentThreadFavorite,
  getAiAgentThreadMessages,
  renameAiAgentThread,
  deleteAiAgentThread,
} from '@/lib/api/endpoints/agentChat';
import {
  listAiAgents,
  listProjectAgents,
  listAgentRuns,
  listAgentTools,
  createAiAgent,
  updateAiAgent,
  regenerateAiAgentKey,
  deleteAiAgent,
  getInvocationSecret,
  rotateInvocationSecret,
  testInvocation,
} from '@/lib/api/endpoints/agents';
import { qk } from '@/services/queryKeys';

// Refetched on an interval because an external agent's runner presence comes from
// this list: without it the online/offline state stays at whatever it was when the
// settings page opened.
const RUNNER_PRESENCE_REFRESH_MS = 30_000;

// The team's agents, or only the ones working in one of its projects.
export function useAiAgentsQuery(teamId: number | null, projectId?: number) {
  return useQuery({
    queryKey: qk.aiAgents(teamId ?? 0, projectId),
    queryFn: () => listAiAgents(teamId!, projectId),
    enabled: teamId != null,
    refetchInterval: RUNNER_PRESENCE_REFRESH_MS,
  });
}

export function useAgentDirectoryQuery(
  project: { id: number; ref: string; teamId: number } | null,
) {
  return useQuery({
    queryKey: qk.agentDirectory(project?.teamId ?? 0, project?.id ?? 0),
    queryFn: () => listProjectAgents(project!.ref),
    enabled: project != null,
  });
}

// An agent's triggered run history for the runs sidebar, paginated 25 at a time. Only
// fetched when agentId is set, so the query runs when the sidebar opens.
export function useAgentRuns(teamId: number | null, agentId: number | null) {
  return useInfiniteQuery({
    queryKey: qk.agentRuns(teamId ?? 0, agentId ?? 0),
    queryFn: ({ pageParam }) => listAgentRuns(teamId!, agentId!, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: teamId != null && agentId != null,
  });
}

// The caller's chat threads with the agents of a project (the chat history), newest first
// and a page at a time. `q` searches them instead, over every page, and is cached as a
// list of its own.
export function useChatThreadsQuery(projectKey: string, q = '') {
  return useInfiniteQuery({
    queryKey: qk.chatThreads(projectKey, q),
    queryFn: ({ pageParam }) => listChatThreads(projectKey, pageParam, q),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextPage ?? undefined,
  });
}

// The starred conversations, in one go. Read by the group on top of the history and by
// the star of the open chat, which share this one request.
export function useFavoriteChatThreadsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.favoriteChatThreads(projectKey),
    queryFn: () => listFavoriteChatThreads(projectKey),
  });
}

// What a change to one conversation names it by.
type ThreadRef = Pick<AiChatThread, 'id' | 'agentId'>;

// The loaded lists of a project with one conversation changed in all of them.
function patchThread(
  qc: QueryClient,
  projectKey: string,
  threadId: string,
  change: Partial<AiChatThread>,
) {
  qc.setQueriesData<InfiniteData<AiChatThreadPage>>(
    { queryKey: qk.chatThreadLists(projectKey) },
    (prev) =>
      prev && {
        ...prev,
        pages: prev.pages.map((page) => ({
          ...page,
          items: page.items.map((thread) =>
            thread.id === threadId ? { ...thread, ...change } : thread,
          ),
        })),
      },
  );
}

function invalidateThreads(qc: QueryClient, projectKey: string) {
  void qc.invalidateQueries({ queryKey: qk.chatThreadLists(projectKey) });
  void qc.invalidateQueries({ queryKey: qk.favoriteChatThreads(projectKey) });
}

// Stars a conversation or takes the star off it. The star flips before the request is
// answered — it is the whole feedback of the click — and rolls back if it fails.
export function useToggleChatThreadFavorite(projectKey: string) {
  const qc = useQueryClient();
  const lists = qk.chatThreadLists(projectKey);
  const favorites = qk.favoriteChatThreads(projectKey);
  return useMutation({
    mutationFn: ({ thread, favorite }: { thread: ThreadRef; favorite: boolean }) =>
      setAiAgentThreadFavorite(projectKey, thread.agentId, thread.id, favorite),
    onMutate: async ({ thread, favorite }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: lists }),
        qc.cancelQueries({ queryKey: favorites }),
      ]);
      const previous = [
        ...qc.getQueriesData({ queryKey: lists }),
        ...qc.getQueriesData({ queryKey: favorites }),
      ];
      patchThread(qc, projectKey, thread.id, { favorite });
      // The group holds the starred conversations themselves, so the one being starred
      // is moved into it and the one being unstarred out of it. A conversation no loaded
      // page holds is only added once the group is read again.
      const starred = threadsOf(qc, lists).find((loaded) => loaded.id === thread.id);
      qc.setQueryData<AiChatThreadPage>(favorites, (prev) => {
        if (!prev) return prev;
        const without = prev.items.filter((loaded) => loaded.id !== thread.id);
        if (!favorite) return { ...prev, items: without };
        return starred ? { ...prev, items: [{ ...starred, favorite: true }, ...without] } : prev;
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      for (const [key, data] of context?.previous ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => invalidateThreads(qc, projectKey),
  });
}

// Every conversation the given lists hold, searches included: where a conversation is
// read from when only its id is at hand.
function threadsOf(qc: QueryClient, key: readonly unknown[]): AiChatThread[] {
  return qc
    .getQueriesData<InfiniteData<AiChatThreadPage>>({ queryKey: key })
    .flatMap(([, data]) => data?.pages.flatMap((page) => page.items) ?? []);
}

// The threads loaded so far, as one list: the pages of the history read until now plus
// the starred ones, which the history keeps out of those pages. The pages it has not
// reached are simply not in it.
export function useLoadedChatThreads(projectKey: string) {
  const query = useChatThreadsQuery(projectKey);
  const favorites = useFavoriteChatThreadsQuery(projectKey);
  return [
    ...(favorites.data?.items ?? []),
    ...(query.data?.pages.flatMap((page) => page.items) ?? []),
  ];
}

// The transcript of one chat thread, to restore the conversation when a thread is
// opened. Only fetched when a thread is selected. What was said since it was read is held
// by the chat alone, so a transcript nobody shows is not kept: it would open without that.
export function useAgentThreadMessagesQuery(
  projectKey: string | null,
  agentId: number | null,
  threadId: string | null,
) {
  return useInfiniteQuery({
    queryKey: qk.agentThreadMessages(projectKey ?? '', agentId ?? 0, threadId ?? ''),
    queryFn: ({ pageParam }) =>
      getAiAgentThreadMessages(projectKey!, agentId!, threadId!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextPage ?? undefined,
    enabled: projectKey != null && agentId != null && threadId != null,
    gcTime: 0,
  });
}

// Renames one of the caller's chat threads. The new title is put into the loaded history
// right away: it is what the open chat is called.
export function useRenameChatThread(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ thread, title }: { thread: ThreadRef; title: string }) =>
      renameAiAgentThread(projectKey, thread.agentId, thread.id, title),
    onSuccess: (_res, { thread, title }) => {
      patchThread(qc, projectKey, thread.id, { title });
      void qc.invalidateQueries({ queryKey: qk.favoriteChatThreads(projectKey) });
    },
  });
}

// Deletes one of the caller's chat threads and refreshes the history it was in.
export function useDeleteChatThread(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (thread: ThreadRef) => deleteAiAgentThread(projectKey, thread.agentId, thread.id),
    onSuccess: () => invalidateThreads(qc, projectKey),
  });
}

// The capability-tool catalog for the internal-agent form. Static per team, so
// it stays fresh for the session.
export function useAgentToolsQuery(teamId: number | null) {
  return useQuery({
    queryKey: qk.agentTools(teamId ?? 0),
    queryFn: () => listAgentTools(teamId!),
    enabled: teamId != null,
    staleTime: Infinity,
  });
}

// Attaching or detaching an agent changes who a project offers as an assignee, so every
// board scaffold the caller has open is refreshed with the agent list.
function useAgentInvalidator(teamId: number | null) {
  const qc = useQueryClient();
  return () => {
    if (teamId != null) void qc.invalidateQueries({ queryKey: qk.teamAiAgents(teamId) });
    void qc.invalidateQueries({ queryKey: ['workItems'] });
  };
}

export function useCreateAiAgent(teamId: number | null) {
  const t = useTranslations('teams.agents');
  const invalidate = useAgentInvalidator(teamId);
  return useMutation({
    mutationFn: (input: Parameters<typeof createAiAgent>[1]) => createAiAgent(teamId!, input),
    onSuccess: (res) => {
      toast.success(t('created', { username: res.agent.username }));
      invalidate();
    },
  });
}

export function useUpdateAiAgent(teamId: number | null) {
  const t = useTranslations('teams.agents');
  const invalidate = useAgentInvalidator(teamId);
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof updateAiAgent>[2] }) =>
      updateAiAgent(teamId!, id, patch),
    onSuccess: (agent) => {
      toast.success(t('saved', { username: agent.username }));
      invalidate();
    },
  });
}

export function useRegenerateAiAgentKey(teamId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => regenerateAiAgentKey(teamId!, id),
    onSuccess: () => {
      if (teamId != null) void qc.invalidateQueries({ queryKey: qk.teamAiAgents(teamId) });
    },
  });
}

// The key an external agent's invocations are signed with, which only a member who may
// edit the agent reads. A save that sets the first URL issues it, and saving refetches
// every agent query, this one included.
export function useInvocationSecretQuery(teamId: number | null, agentId: number | null) {
  return useQuery({
    queryKey: qk.invocationSecret(teamId ?? 0, agentId ?? 0),
    queryFn: () => getInvocationSecret(teamId!, agentId!),
    enabled: teamId != null && agentId != null,
  });
}

export function useRotateInvocationSecret(teamId: number | null) {
  const t = useTranslations('teams.agents');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: number) => rotateInvocationSecret(teamId!, agentId),
    onSuccess: (res, agentId) => {
      toast.success(t('invocationSecretRotated'));
      if (teamId != null) qc.setQueryData(qk.invocationSecret(teamId, agentId), res);
    },
  });
}

export function useTestInvocation(teamId: number | null) {
  return useMutation({ mutationFn: (agentId: number) => testInvocation(teamId!, agentId) });
}

export function useDeleteAiAgent(teamId: number | null) {
  const invalidate = useAgentInvalidator(teamId);
  return useMutation({
    mutationFn: (id: number) => deleteAiAgent(teamId!, id),
    onSuccess: invalidate,
  });
}
