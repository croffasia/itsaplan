import { type FeedItem } from '@/lib/api';
import { useFeedQuery, useGroupedFeedQuery } from '../services/comments.service';

// The last comment written on the issue, read from whatever the activity section has
// already loaded: both queries run with fetching off, so this asks for no page of its
// own. Both feed shapes are taken together because only one of them is on screen and
// the other can still hold a page loaded earlier in the session.
export function useLastComment(issueId: number): FeedItem | undefined {
  const flatFeed = useFeedQuery(issueId, false);
  const groupedFeed = useGroupedFeedQuery(issueId, false);

  return [
    ...(flatFeed.data?.pages ?? []).flatMap((page) => page.items),
    ...(groupedFeed.data?.pages ?? []).flatMap((page) =>
      page.groups.flatMap((group) => group.items),
    ),
  ]
    .filter((item) => item.kind === 'comment')
    .reduce<FeedItem | undefined>(
      (newest, item) => (!newest || item.createdAt > newest.createdAt ? item : newest),
      undefined,
    );
}
