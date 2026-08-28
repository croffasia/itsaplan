import { db, agentChatFavorite } from '@repo/db';
import { and, eq, inArray } from 'drizzle-orm';

// The conversations a member starred (see the agent_chat_favorite comment in the
// schema). Both kinds of agent are starred here: the row names the thread by id, and
// the thread itself lives either in agent_chat_thread or in Mastra's tables, so the
// two stores share this module the way they share chat-usage.

// How many starred conversations the favorites group shows. The group is not paginated,
// so it is bounded here.
export const FAVORITES_LIMIT = 50;

// Which of the given threads the user starred.
export async function readFavorites(userId: string, threadIds: string[]): Promise<Set<string>> {
  if (threadIds.length === 0) return new Set();
  const rows = await db
    .select({ threadId: agentChatFavorite.threadId })
    .from(agentChatFavorite)
    .where(
      and(eq(agentChatFavorite.userId, userId), inArray(agentChatFavorite.threadId, threadIds)),
    );
  return new Set(rows.map((row) => row.threadId));
}

// The threads the user starred with one agent. Only the ids: the conversations
// themselves are read from whichever store holds them, which is also where the group
// is cut to FAVORITES_LIMIT, newest first.
export async function favoriteThreadIds(userId: string, agentId: number): Promise<string[]> {
  const rows = await db
    .select({ threadId: agentChatFavorite.threadId })
    .from(agentChatFavorite)
    .where(and(eq(agentChatFavorite.userId, userId), eq(agentChatFavorite.agentId, agentId)));
  return rows.map((row) => row.threadId);
}

// Stars a conversation. Starring one that is already starred changes nothing; the
// caller has checked the thread is theirs.
export async function addFavorite(
  userId: string,
  agentId: number,
  threadId: string,
): Promise<void> {
  await db.insert(agentChatFavorite).values({ userId, agentId, threadId }).onConflictDoNothing();
}

export async function removeFavorite(userId: string, threadId: string): Promise<void> {
  await db
    .delete(agentChatFavorite)
    .where(and(eq(agentChatFavorite.userId, userId), eq(agentChatFavorite.threadId, threadId)));
}

// The row has no foreign key to the thread, so deleting the thread has to take it along.
export async function deleteFavorite(threadId: string): Promise<void> {
  await db.delete(agentChatFavorite).where(eq(agentChatFavorite.threadId, threadId));
}
