import { type FeedItem } from '@/lib/api';
import ActivityLine from './ActivityLine';
import CommentItem from './CommentItem';

// A list of feed entries in the order given: comments render as an authored block,
// change-log entries as a one-line sentence. Shared by the live feed, the shared
// read-only feed, and the timeline's per-status popover.

export default function ActivityItemList({
  items,
  imageByUserId,
}: {
  items: FeedItem[];
  // Uploaded avatar per actor id (a feed entry stores the name, not the picture).
  imageByUserId: Map<string, string | null>;
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) =>
        item.kind === 'comment' ? (
          <CommentItem
            key={item.id}
            item={item}
            image={(item.actorUserId && imageByUserId.get(item.actorUserId)) ?? null}
          />
        ) : (
          <ActivityLine key={item.id} item={item} />
        ),
      )}
    </ul>
  );
}
