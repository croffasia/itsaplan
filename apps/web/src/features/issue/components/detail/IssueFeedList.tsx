import { type FeedItem } from '@/lib/api';
import { useFeedQuery } from '../../services/comments.service';
import { Button } from '@/components/ui/button';
import ActivityItemList from './ActivityItemList';

// The flat activity list, newest first, paged 25 at a time by "Show more". The feed
// query refetches on its own when an issue edit invalidates it (see useUpdateIssue /
// useSetFieldValue), so it reflects edits without the parent signaling it.

export default function IssueFeedList({
  issueId,
  imageByUserId,
}: {
  issueId: number;
  imageByUserId: Map<string, string | null>;
}) {
  const feedQuery = useFeedQuery(issueId);

  // The pages come back newest first. Dedupe by id so a boundary item that shifts
  // between pages after a refetch (an edit adds new entries at the top) never
  // renders with a duplicate key. The first copy wins: it comes from the newer
  // page, so an edited comment keeps its latest body.
  const byId = new Map<number, FeedItem>();
  for (const item of (feedQuery.data?.pages ?? []).flatMap((p) => p.items)) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  const items = [...byId.values()];

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {feedQuery.isLoading ? 'Loading…' : 'No activity yet.'}
      </p>
    );
  }

  return (
    <>
      <ActivityItemList items={items} imageByUserId={imageByUserId} />
      {feedQuery.hasNextPage && (
        <div className="mt-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={feedQuery.isFetchingNextPage}
            onClick={() => void feedQuery.fetchNextPage()}
          >
            {feedQuery.isFetchingNextPage ? 'Loading…' : 'Show more'}
          </Button>
        </div>
      )}
    </>
  );
}
