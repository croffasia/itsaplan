import { type FeedItem } from '@/lib/api';
import ActivityLine from './ActivityLine';
import CommentThread from './CommentThread';
import { type ComposerContext } from './CommentComposer';

// A list of feed entries in the order given: a comment and its replies render as one
// thread card, change-log entries as a one-line sentence between the cards. Shared by
// the live feed, the shared read-only feed, and the timeline's per-status popover.

export default function ActivityItemList({
  items,
  imageByUserId,
  composer,
}: {
  items: FeedItem[];
  // Uploaded avatar per actor id (a feed entry stores the name, not the picture).
  imageByUserId: Map<string, string | null>;
  // What a reply box needs to post. Left out where replying is not offered: the
  // shared read-only feed and the timeline popover.
  composer?: ComposerContext;
}) {
  // The feed carries a thread flat: the replies of a comment follow it, each naming
  // its parent. A reply whose parent is not in this list (the timeline popover cuts
  // the feed by time) opens a thread of its own rather than dropping out of the list.
  const present = new Set(items.map((item) => item.id));
  const repliesByParent = new Map<number, FeedItem[]>();
  const roots: FeedItem[] = [];
  for (const item of items) {
    if (item.replyToId != null && present.has(item.replyToId)) {
      const siblings = repliesByParent.get(item.replyToId) ?? [];
      siblings.push(item);
      repliesByParent.set(item.replyToId, siblings);
    } else {
      roots.push(item);
    }
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {roots.map((item) =>
        item.kind === 'comment' ? (
          <CommentThread
            key={item.id}
            root={item}
            repliesByParent={repliesByParent}
            imageByUserId={imageByUserId}
            composer={composer}
          />
        ) : (
          <ActivityLine key={item.id} item={item} />
        ),
      )}
    </ul>
  );
}
