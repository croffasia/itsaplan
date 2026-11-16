import { db, issueActivity, issueActivityReaction, user } from '@repo/db';
import { and, eq, inArray } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import { notifyReaction } from '#modules/notifications/service';

// Emoji reactions on issue comments. A member reacts to a comment with any number of
// different emoji, each one once.

// One emoji on a comment and the members who reacted with it, the first first.
export interface CommentReactionRow {
  emoji: string;
  users: { id: string; name: string }[];
}

// The most different emoji one comment carries. The feed serves every reaction of
// every comment on a page, so the set stays small.
export const MAX_COMMENT_EMOJI = 20;

// Exactly one emoji as Unicode recommends it for interchange: a flag, a keycap and a
// joined sequence count as one. The `v` flag is newer than the compile target, so the
// expression is built from a string.
const SINGLE_EMOJI = new RegExp('^\\p{RGI_Emoji}$', 'v');

function assertEmoji(emoji: string): void {
  if (!SINGLE_EMOJI.test(emoji)) throw new HttpError(400, 'emoji must be a single emoji');
}

// The reactions of each given comment, keyed by comment id. Emoji are in the order
// they first appeared on the comment, and so are the members under each. A comment
// without reactions has no key.
export async function listReactions(
  commentIds: number[],
): Promise<Map<number, CommentReactionRow[]>> {
  const byComment = new Map<number, CommentReactionRow[]>();
  if (commentIds.length === 0) return byComment;
  const rows = await db
    .select({
      activityId: issueActivityReaction.activityId,
      emoji: issueActivityReaction.emoji,
      userId: issueActivityReaction.userId,
      userName: user.name,
    })
    .from(issueActivityReaction)
    .innerJoin(user, eq(user.id, issueActivityReaction.userId))
    .where(inArray(issueActivityReaction.activityId, commentIds))
    .orderBy(issueActivityReaction.createdAt, issueActivityReaction.userId);
  for (const row of rows) {
    const reactions = byComment.get(row.activityId) ?? [];
    byComment.set(row.activityId, reactions);
    let reaction = reactions.find((r) => r.emoji === row.emoji);
    if (!reaction) {
      reaction = { emoji: row.emoji, users: [] };
      reactions.push(reaction);
    }
    reaction.users.push({ id: row.userId, name: row.userName });
  }
  return byComment;
}

// Adds the user's reaction, tells the comment's author (see notifyReaction), and returns
// the comment's reactions. Reacting again with the same emoji changes nothing. The
// comment row is locked while the emoji are counted, so two members adding at once
// cannot pass the limit together.
export async function addReaction(
  commentId: number,
  userId: string,
  emoji: string,
  projectId: number,
): Promise<CommentReactionRow[]> {
  assertEmoji(emoji);
  const added = await db.transaction(async (tx) => {
    const [comment] = await tx
      .select({
        id: issueActivity.id,
        issueId: issueActivity.issueId,
        actorUserId: issueActivity.actorUserId,
      })
      .from(issueActivity)
      .where(and(eq(issueActivity.id, commentId), eq(issueActivity.kind, 'comment')))
      .for('no key update');
    if (!comment) throw new HttpError(404, 'Comment not found');
    const used = await tx
      .selectDistinct({ emoji: issueActivityReaction.emoji })
      .from(issueActivityReaction)
      .where(eq(issueActivityReaction.activityId, commentId));
    if (used.length >= MAX_COMMENT_EMOJI && !used.some((row) => row.emoji === emoji))
      throw new HttpError(409, `A comment takes at most ${MAX_COMMENT_EMOJI} different emoji`);
    const rows = await tx
      .insert(issueActivityReaction)
      .values({ activityId: commentId, userId, emoji })
      .onConflictDoNothing()
      .returning({ activityId: issueActivityReaction.activityId });
    return rows.length > 0 ? comment : null;
  });
  if (added?.issueId != null)
    await notifyReaction(projectId, { ...added, issueId: added.issueId }, userId, emoji);
  return (await listReactions([commentId])).get(commentId) ?? [];
}

// Removes the user's reaction. Removing one that is not there changes nothing.
export async function removeReaction(
  commentId: number,
  userId: string,
  emoji: string,
): Promise<void> {
  await db
    .delete(issueActivityReaction)
    .where(
      and(
        eq(issueActivityReaction.activityId, commentId),
        eq(issueActivityReaction.userId, userId),
        eq(issueActivityReaction.emoji, emoji),
      ),
    );
}
