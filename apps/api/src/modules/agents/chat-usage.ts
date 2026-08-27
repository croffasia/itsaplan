import { db, agentChatUsage } from '@repo/db';
import { eq, inArray } from 'drizzle-orm';

// The context size of a chat thread: the token counts of the last completed answer in
// it. Both kinds of agent report it — an external one through its runner, an internal
// one from the model call itself — and both are kept in the same table, keyed by the
// thread (see the agent_chat_usage comment in the schema).
//
// The number answers how close the conversation is to the agent's context limit, so it
// is measured on the last model call of an answer, not summed over the calls the answer
// took.

// The counts of one model call, normalised: everything that call read, cache included,
// and everything it wrote.
export interface ContextUsage {
  inputTokens: number;
  outputTokens: number;
}

// Records the counts of a completed answer, replacing the thread's previous ones. Null
// says the agent reports nothing that can be read as a context size, which is a fact
// about the agent and is shown as a dash.
export async function recordContextUsage(
  threadId: string,
  agentId: number,
  usage: ContextUsage | null,
): Promise<void> {
  const counts = {
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
  };
  await db
    .insert(agentChatUsage)
    .values({ threadId, agentId, ...counts })
    .onConflictDoUpdate({
      target: agentChatUsage.threadId,
      set: { ...counts, updatedAt: new Date() },
    });
}

// The context size of each of the given threads. A thread with no completed answer is
// absent from the map; one whose agent reports no usable counts maps to null.
export async function readContextTokens(threadIds: string[]): Promise<Map<string, number | null>> {
  const sizes = new Map<string, number | null>();
  if (threadIds.length === 0) return sizes;
  const rows = await db
    .select()
    .from(agentChatUsage)
    .where(inArray(agentChatUsage.threadId, threadIds));
  for (const row of rows) {
    const read = row.inputTokens;
    sizes.set(row.threadId, read == null ? null : read + (row.outputTokens ?? 0));
  }
  return sizes;
}

// Drops a thread's counts. The row has no foreign key to the thread, so deleting the
// thread has to take it along.
export async function deleteContextUsage(threadId: string): Promise<void> {
  await db.delete(agentChatUsage).where(eq(agentChatUsage.threadId, threadId));
}
