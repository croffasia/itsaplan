import type { FeedItem } from '@/lib/api/endpoints/activity';
import { type FeedSlice, useFeedQuery } from '../../services/comments.service';
import ShowMoreButton from '@/components/common/ShowMoreButton';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import ActivityItemList from './ActivityItemList';
import { type ComposerContext } from './CommentComposer';

// The flat activity list in the order the slice asks for, paged 25 at a time by
// "Show more". The feed query refetches on its own when an issue edit invalidates it
// (see useUpdateIssue / useSetFieldValue), so it reflects edits without the parent
// signaling it.

export default function IssueFeedList({
  issueId,
  slice,
  imageByUserId,
  composer,
  emptyText,
}: {
  issueId: number;
  slice: FeedSlice;
  imageByUserId: Map<string, string | null>;
  composer: ComposerContext;
  emptyText: string;
}) {
  const feedQuery = useFeedQuery(issueId, slice);

  // Dedupe by id so a boundary item that shifts between pages after a refetch (an
  // edit adds new entries at the top of a newest-first feed) never renders with a
  // duplicate key. The first copy wins.
  const byId = new Map<number, FeedItem>();
  for (const item of (feedQuery.data?.pages ?? []).flatMap((p) => p.items)) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  const items = [...byId.values()];

  if (feedQuery.isLoading) return <ListSkeleton rows={3} rowClassName="h-12" />;

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <>
      <ActivityItemList items={items} imageByUserId={imageByUserId} composer={composer} />
      {feedQuery.hasNextPage && (
        <ShowMoreButton
          loading={feedQuery.isFetchingNextPage}
          onClick={() => void feedQuery.fetchNextPage()}
        />
      )}
    </>
  );
}
