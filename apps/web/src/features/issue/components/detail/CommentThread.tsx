import { useState } from 'react';
import { type FeedItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import CommentItem from './CommentItem';
import CommentComposer, { type ComposerContext } from './CommentComposer';

// A comment and everything written under it, as one card: the comments are its rows,
// split by a hairline, each reply a step further in than what it answers, and the
// reply box opens at the bottom. Read as one exchange rather than a stack of boxes.
// The issue panel is itself a `card` surface, so the thread stands off it by a
// darker fill and a soft shadow; an outline at this size would pull more attention
// than the comments do.

// How deep a reply keeps stepping in. Past it the thread still nests, but on the same
// indent, so a long exchange does not squeeze the text off the screen.
const MAX_INDENT_DEPTH = 3;

// One row of the card: a comment and how far under the root it hangs.
interface Row {
  item: FeedItem;
  depth: number;
}

export default function CommentThread({
  root,
  repliesByParent,
  imageByUserId,
  composer,
}: {
  root: FeedItem;
  repliesByParent: Map<number, FeedItem[]>;
  // Uploaded avatar per actor id (a feed entry stores the name, not the picture).
  imageByUserId: Map<string, string | null>;
  composer?: ComposerContext;
}) {
  // The row the open box answers, null while it is closed.
  const [replyTo, setReplyTo] = useState<Row | null>(null);

  const rows: Row[] = [];
  const collect = (item: FeedItem, depth: number) => {
    rows.push({ item, depth });
    for (const reply of repliesByParent.get(item.id) ?? []) collect(reply, depth + 1);
  };
  collect(root, 0);

  return (
    <li className="overflow-hidden rounded-lg border border-black/4 bg-muted/40 shadow-xs dark:border-white/8 dark:bg-background/60">
      {rows.map((row, index) => (
        <div
          key={row.item.id}
          className={cn(
            'px-3 py-2.5',
            index > 0 && 'border-t border-border/50',
            indentClass(row.depth),
          )}
        >
          <CommentItem
            item={row.item}
            image={(row.item.actorUserId && imageByUserId.get(row.item.actorUserId)) ?? null}
            onReply={composer ? () => setReplyTo(row) : undefined}
          />
        </div>
      ))}
      {replyTo && composer && (
        <div
          className={cn('border-t border-border/50 px-3 py-2.5', indentClass(replyTo.depth + 1))}
        >
          <CommentComposer
            {...composer}
            replyToId={replyTo.item.id}
            replyToName={replyTo.item.actorName}
            onClose={() => setReplyTo(null)}
          />
        </div>
      )}
    </li>
  );
}

// Spelled out rather than computed: Tailwind generates only the classes it finds in
// the source.
function indentClass(depth: number): string {
  const step = Math.min(depth, MAX_INDENT_DEPTH);
  return ['', 'ps-7', 'ps-11', 'ps-15'][step];
}
