// Issue feed (comments + activity) reads and comment writes. The low-level fetch
// client (api.ts) is untouched; this module wraps it.

import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api, type FeedCursor } from '@/lib/api';
import { qk } from '@/services/queryKeys';

// The issue's timeline (comments + activity), paged newest first. Each page is
// 25 items; getNextPageParam yields the server's cursor until it returns null.
export function useFeedQuery(id: number, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.feed(id),
    queryFn: ({ pageParam }) => api.listFeed(id, { cursor: pageParam, limit: 25 }),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
  });
}

// The same entries as useFeedQuery, split by the status the issue was in when each
// was written. Paged the same way, and by the same cursor: a stretch that spans a page
// boundary comes back in both pages, and the feed joins the halves.
export function useGroupedFeedQuery(id: number, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.groupedFeed(id),
    queryFn: ({ pageParam }) => api.listGroupedFeed(id, { cursor: pageParam, limit: 25 }),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
  });
}

// The stretches the issue spent in one status, oldest first. Carries no entries,
// so it stays small however long the issue's history is.
export function useTimelineQuery(id: number) {
  return useQuery({ queryKey: qk.timeline(id), queryFn: () => api.listTimeline(id) });
}

// One time range of the issue's activity, as the timeline addresses its stretches.
export interface TimelineRange {
  from: string;
  to: string | null;
}

// The entries of the given stretches, merged in chronological order. A status may
// have been visited more than once, so a lane's popover asks for several ranges at
// once. Called from inside an open popover, which is what makes it a read on demand.
export function useTimelineItemsQuery(issueId: number, ranges: TimelineRange[]) {
  return useQueries({
    queries: ranges.map((range) => ({
      queryKey: qk.timelineItems(issueId, range.from, range.to),
      queryFn: () => api.listTimelineItems(issueId, range.from, range.to),
    })),
    combine: (results) => ({
      isPending: results.some((r) => r.isPending),
      isError: results.some((r) => r.isError),
      items: results.flatMap((r) => r.data ?? []),
    }),
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      issueId,
      input,
    }: {
      issueId: number;
      input: { body: string; replyToId?: number };
    }) => api.createComment(issueId, input),
    onSuccess: (_data, { issueId }) => void qc.invalidateQueries({ queryKey: qk.feed(issueId) }),
  });
}
