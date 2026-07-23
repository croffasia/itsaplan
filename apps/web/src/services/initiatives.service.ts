import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  api,
  type FeedCursor,
  type InitiativeListParams,
  type InitiativePatch,
  type NewInitiativeInput,
} from '@/lib/api';
import { qk } from '@/services/queryKeys';

// A page of the project's initiatives. params filter (status/search), sort and
// page it server-side; keepPreviousData holds the current page on screen while the
// next one loads. Omit params to load the default first page.
export function useInitiativesQuery(projectKey: string | null, params: InitiativeListParams = {}) {
  return useQuery({
    queryKey: qk.initiatives(projectKey ?? '', params as Record<string, unknown>),
    queryFn: () => api.listInitiatives(projectKey!, params),
    enabled: projectKey != null,
    placeholderData: keepPreviousData,
  });
}

// Per-status counts for the list's status tabs, independent of the current page.
export function useInitiativeCountsQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.initiativeCounts(projectKey ?? ''),
    queryFn: () => api.initiativeCounts(projectKey!),
    enabled: projectKey != null,
  });
}

export function useInitiativeQuery(id: number | null) {
  return useQuery({
    queryKey: qk.initiative(id ?? 0),
    queryFn: () => api.getInitiative(id!),
    enabled: id != null,
  });
}

export function useCreateInitiative(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewInitiativeInput) => api.createInitiative(projectKey, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.initiativesForProject(projectKey) });
      qc.invalidateQueries({ queryKey: qk.initiativeCounts(projectKey) });
      qc.invalidateQueries({ queryKey: qk.project(projectKey) });
    },
  });
}

export function useUpdateInitiative(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: InitiativePatch }) =>
      api.updateInitiative(id, patch),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: qk.initiativesForProject(projectKey) });
      qc.invalidateQueries({ queryKey: qk.initiativeCounts(projectKey) });
      qc.invalidateQueries({ queryKey: qk.project(projectKey) });
      qc.invalidateQueries({ queryKey: qk.initiative(id) });
      qc.invalidateQueries({ queryKey: qk.initiativeFeed(id) });
    },
  });
}

export function useDeleteInitiative(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteInitiative(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: qk.initiativesForProject(projectKey) });
      qc.invalidateQueries({ queryKey: qk.initiativeCounts(projectKey) });
      qc.invalidateQueries({ queryKey: qk.project(projectKey) });
      // Deleting an initiative unlinks its issues (initiativeId -> null), so the
      // board issues change too.
      qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
      qc.invalidateQueries({ queryKey: qk.initiative(id) });
    },
  });
}

// The initiative's feed (its own events plus its linked issues' activity), paged
// newest first. Each page is 25 items; getNextPageParam yields the server's cursor
// until it returns null.
export function useInitiativeFeedQuery(id: number | null) {
  return useInfiniteQuery({
    queryKey: qk.initiativeFeed(id ?? 0),
    queryFn: ({ pageParam }) => api.listInitiativeFeed(id!, { cursor: pageParam, limit: 25 }),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: id != null,
  });
}
