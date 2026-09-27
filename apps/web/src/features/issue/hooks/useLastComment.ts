import type { FeedItem } from '@/lib/api/endpoints/activity';
import { useFeedQuery, useGroupedFeedQuery } from '../services/comments.service';
import { type ActivityFeedView } from './useActivityFeedView';

// The newest comment the activity log shows, read from the pages it has already
// loaded: the query runs with fetching off, so this asks for no page of its own. Only
// the view on screen is read, so the comment the bubble scrolls to is always rendered.
// An oldest-first log loads its oldest pages, which need not hold the newest comment,
// so it gets none.
export function useLastComment(issueId: number, view: ActivityFeedView): FeedItem | undefined {
  const flatFeed = useFeedQuery(issueId, view.slice, false);
  const groupedFeed = useGroupedFeedQuery(issueId, view.slice, false);

  if (view.order === 'asc') return undefined;
  const items = view.grouped
    ? (groupedFeed.data?.pages ?? []).flatMap((page) => page.groups.flatMap((g) => g.items))
    : (flatFeed.data?.pages ?? []).flatMap((page) => page.items);
  return items
    .filter((item) => item.kind === 'comment')
    .reduce<FeedItem | undefined>(
      (newest, item) => (!newest || item.createdAt > newest.createdAt ? item : newest),
      undefined,
    );
}
