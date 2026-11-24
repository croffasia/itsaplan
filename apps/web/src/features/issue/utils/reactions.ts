import type { CommentReaction } from '@/lib/api/endpoints/activity';

// The member looking at the feed, as a reaction names them.
export interface ReactionViewer {
  id: string;
  name: string;
}

export function hasReacted(reactions: CommentReaction[], emoji: string, userId: string): boolean {
  return reactions.some((r) => r.emoji === emoji && r.users.some((u) => u.id === userId));
}

// The emoji the given member reacted with.
export function reactedEmojis(reactions: CommentReaction[], userId?: string): string[] {
  return reactions.filter((r) => r.users.some((u) => u.id === userId)).map((r) => r.emoji);
}

// The reactions with the viewer's own reaction for one emoji set on or off. Setting
// the state they already hold returns the same list, so a pending write drawn over
// a feed that already carries it changes nothing.
export function withReaction(
  reactions: CommentReaction[],
  emoji: string,
  viewer: ReactionViewer,
  reacted: boolean,
): CommentReaction[] {
  if (hasReacted(reactions, emoji, viewer.id) === reacted) return reactions;
  if (reacted && !reactions.some((r) => r.emoji === emoji))
    return [...reactions, { emoji, users: [viewer] }];
  return reactions
    .map((r) => {
      if (r.emoji !== emoji) return r;
      const users = reacted ? [...r.users, viewer] : r.users.filter((u) => u.id !== viewer.id);
      return { emoji, users };
    })
    .filter((r) => r.users.length > 0);
}
