import { useState } from 'react';
import type { FeedItem } from '@/lib/api/endpoints/activity';
import { useSetCommentReaction } from '../services/comments.service';
import { hasReacted, withReaction, type ReactionViewer } from '../utils/reactions';

// A comment's reactions and the switch for the viewer's own. A change shows at once,
// drawn over the feed until the feed read that follows the write carries it; a failed
// write drops it. Without a viewer the reactions are read-only and `toggle` is absent.
export function useCommentReactions(item: FeedItem, viewer?: ReactionViewer) {
  const setReaction = useSetCommentReaction();
  // The state each emoji is being written to, by emoji.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  if (!viewer) return { reactions: item.reactions };

  const reactions = Object.entries(pending).reduce(
    (list, [emoji, reacted]) => withReaction(list, emoji, viewer, reacted),
    item.reactions,
  );

  const toggle = (emoji: string) => {
    if (emoji in pending) return;
    const reacted = !hasReacted(reactions, emoji, viewer.id);
    setPending((current) => ({ ...current, [emoji]: reacted }));
    setReaction
      .mutateAsync({ issueId: item.issueId, commentId: item.id, emoji, reacted })
      // The MutationCache toasts the failure.
      .catch(() => {})
      .finally(() =>
        setPending((current) => {
          const rest = { ...current };
          delete rest[emoji];
          return rest;
        }),
      );
  };
  return { reactions, toggle };
}
