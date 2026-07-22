// Issue feed (comments + activity) reads and comment writes. The low-level fetch
// client (api.ts) is untouched; this module wraps it.

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type FeedCursor } from '@/lib/api';
import { qk } from '@/services/queryKeys';

// The issue's timeline (comments + activity), paged newest first. Each page is
// 25 items; getNextPageParam yields the server's cursor until it returns null.
export function useFeedQuery(id: number) {
  return useInfiniteQuery({
    queryKey: qk.feed(id),
    queryFn: ({ pageParam }) => api.listFeed(id, { cursor: pageParam, limit: 25 }),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, input }: { issueId: number; input: { body: string } }) =>
      api.createComment(issueId, input),
    onSuccess: (_data, { issueId }) => void qc.invalidateQueries({ queryKey: qk.feed(issueId) }),
  });
}
