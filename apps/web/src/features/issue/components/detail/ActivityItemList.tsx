import type { FeedItem } from '@/lib/api/endpoints/activity';
import ActivityRun from './ActivityRun';
import CommentThread from './CommentThread';
import { type ComposerContext } from './CommentComposer';

// A list of feed entries in the order given, on one vertical line: a comment and its
// replies render as one thread, change-log entries as a one-line sentence. Changes of
// the same kind by the same person in a row collapse into their first line, which
// opens the rest. Shared by the live feed, the shared read-only feed, and the
// timeline's per-status popover.

type Row = { comment: FeedItem } | { run: FeedItem[] };

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
  const rows: Row[] = [];
  for (const item of items) {
    if (item.replyToId != null && present.has(item.replyToId)) {
      const siblings = repliesByParent.get(item.replyToId) ?? [];
      siblings.push(item);
      repliesByParent.set(item.replyToId, siblings);
    } else if (item.kind === 'comment') {
      rows.push({ comment: item });
    } else {
      const last = rows[rows.length - 1];
      if (last && 'run' in last && sameChange(last.run[0], item)) last.run.push(item);
      else rows.push({ run: [item] });
    }
  }

  return (
    <ul className="relative flex flex-col gap-1 before:absolute before:inset-y-3 before:start-3 before:w-px before:bg-border">
      {rows.map((row) =>
        'comment' in row ? (
          <CommentThread
            key={row.comment.id}
            root={row.comment}
            repliesByParent={repliesByParent}
            imageByUserId={imageByUserId}
            composer={composer}
          />
        ) : (
          <ActivityRun key={row.run[0].id} run={row.run} />
        ),
      )}
    </ul>
  );
}

function sameChange(a: FeedItem, b: FeedItem): boolean {
  return a.action === b.action && a.actorUserId === b.actorUserId && a.actorName === b.actorName;
}
