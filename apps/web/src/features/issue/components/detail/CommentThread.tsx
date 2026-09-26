import { useState } from 'react';
import type { FeedItem } from '@/lib/api/endpoints/activity';
import { useSession } from '@/lib/auth-client';
import { usePermissions } from '@/hooks/usePermissions';
import CommentItem from './CommentItem';
import CommentComposer, { type ComposerContext } from './CommentComposer';

// A comment and everything written under it: each reply a step further in than what
// it answers, and the reply box opens at the bottom.

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

  // Edit and delete join the reply button where the feed is interactive. The same
  // rule the API asserts: the author with work_items edit, or a project owner.
  const { data: session } = useSession();
  const { can, isOwner } = usePermissions();
  const canEditItems = composer != null && can('work_items', 'edit');
  const manages = (item: FeedItem) =>
    canEditItems && (isOwner || item.actorUserId === session?.user.id);

  const rows: Row[] = [];
  const collect = (item: FeedItem, depth: number) => {
    rows.push({ item, depth });
    for (const reply of repliesByParent.get(item.id) ?? []) collect(reply, depth + 1);
  };
  collect(root, 0);

  return (
    <li className="flex flex-col gap-2 py-1.5">
      {rows.map((row) => (
        <div key={row.item.id} className={indentClass(row.depth)}>
          <CommentItem
            item={row.item}
            image={(row.item.actorUserId && imageByUserId.get(row.item.actorUserId)) ?? null}
            onReply={composer ? () => setReplyTo(row) : undefined}
            canEdit={manages(row.item)}
            canDelete={manages(row.item)}
            composer={composer}
          />
        </div>
      ))}
      {replyTo && composer && (
        <div className={indentClass(replyTo.depth + 1)}>
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
  return ['', 'ps-8.5', 'ps-12.5', 'ps-16.5'][step];
}
