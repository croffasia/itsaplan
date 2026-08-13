// Conversation thread ids. The id says what the conversation is scoped to, so a run
// picks the thread it continues without a lookup, and a chat thread is checked against
// its caller by reading the id alone.

// A chat thread belongs to one (agent, user) pair; the uuid separates a user's several
// conversations with the same agent.
export function newChatThreadId(agentId: number, userId: string): string {
  return `chat:${agentId}:${userId}:${crypto.randomUUID()}`;
}

export function isChatThreadId(threadId: string): boolean {
  return threadId.startsWith('chat:');
}

// Whether the chat thread id was issued for this (agent, caller) pair. A caller can
// only mint an id carrying their own user id, so a mismatch means the thread is someone
// else's chat or an autonomous run thread, and the caller gets a 404.
export function isOwnChatThread(threadId: string, agentId: number, userId: string): boolean {
  return threadId.startsWith(`chat:${agentId}:${userId}:`);
}

// The thread an autonomous run continues: one per (agent, issue) for an issue run, one
// per schedule for a scheduled run (a schedule belongs to a single agent, so its id
// already names the agent). Repeated runs then build on what the agent did before, and
// a retry sees how the failed attempt ended. The run-scoped id is the fallback for a
// run with neither, which nothing enqueues today — both columns are nullable.
export function runThreadId(run: {
  id: number;
  agentId: number;
  issueId: number | null;
  scheduleId: number | null;
}): string {
  if (run.issueId != null) return `issue:${run.issueId}:${run.agentId}`;
  if (run.scheduleId != null) return `schedule:${run.scheduleId}`;
  return `run:${run.id}`;
}
