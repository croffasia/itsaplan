import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { toIso } from '../helpers/dates';
import { appendTextPart, toolArgsText, toolText } from '../../chat-parts';
import { deleteContextUsage, readContextTokens } from '../../chat-usage';
import type { ChatMessageDTO, ChatMessagePage, ChatPart, ChatThreadPage } from '../../model';

// Conversation memory for internal agents. Threads and their messages are
// persisted in a Postgres-backed store (Mastra manages its own tables), reusing
// DATABASE_URL. When an agent has memory enabled, a run recalls the last N
// messages of the given thread. Only the recency window is used (no semantic
// recall), so no vector store is required.
//
// Every thread carries metadata binding it to what it belongs to: the agent and
// project always, the issue or schedule for an autonomous run, plus the kind (a UI
// chat or a run). Two things read it. The chat history lists a user's own
// conversations with one agent — the thread's resourceId is the caller's user id, so
// filtering by (resourceId, agentId, kind "chat") returns exactly those. And deleting
// any of those bindings deletes the threads bound to it, since Mastra's tables carry
// no foreign keys of ours.

// Default recency window when an agent has memory enabled but no count set.
export const DEFAULT_LAST_MESSAGES = 20;

const THREAD_PAGE_SIZE = 25;
// The length a title is cut to, the same for one the agent was given and one a member
// typed.
const TITLE_LIMIT = 80;

let store: PostgresStore | null = null;

function getStore(): PostgresStore {
  if (!store) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required for agent memory');
    store = new PostgresStore({ id: 'ai-agent-memory', connectionString: url });
  }
  return store;
}

export function buildMemory(lastMessages: number): Memory {
  return new Memory({
    storage: getStore(),
    options: { lastMessages, semanticRecall: false },
  });
}

// A single shared Memory instance for reading threads and messages (listing,
// hydrating a conversation). Reads do not depend on the recency window, so any
// lastMessages value works; it shares the same PostgresStore as the run memory.
let readMemory: Memory | null = null;

function getReadMemory(): Memory {
  if (!readMemory) readMemory = buildMemory(DEFAULT_LAST_MESSAGES);
  return readMemory;
}

// What a thread is bound to, written when it is created. `kind` separates a UI
// conversation from an autonomous run thread; `issueId` and `scheduleId` are set for
// an issue run and a scheduled run.
type ThreadMeta = {
  agentId: number;
  projectId: number;
  kind: 'chat' | 'run';
  issueId?: number;
  scheduleId?: number;
};

// Creates the thread with its bindings and an initial title (the first prompt,
// truncated) unless it already exists, so continuing a conversation leaves its
// metadata and title alone.
export async function ensureThread(
  threadId: string,
  resourceId: string,
  meta: ThreadMeta,
  title: string,
): Promise<void> {
  const memory = getReadMemory();
  if (await memory.getThreadById({ threadId })) return;
  await memory.createThread({
    threadId,
    resourceId,
    title: title.slice(0, TITLE_LIMIT),
    metadata: meta,
    saveThread: true,
  });
}

// Renames one of the caller's chat threads. Returns false when the thread does not
// exist or belongs to someone else, so the caller maps it to a 404.
export async function renameChatThread(
  threadId: string,
  resourceId: string,
  title: string,
): Promise<boolean> {
  const memory = getReadMemory();
  const thread = await memory.getThreadById({ threadId, resourceId });
  if (!thread) return false;
  await memory.updateThread({ id: threadId, title: title.slice(0, TITLE_LIMIT) });
  return true;
}

// Deletes one of the caller's chat threads with its messages. Returns false when the
// thread does not exist or belongs to someone else, so the caller maps it to a 404.
export async function deleteChatThread(threadId: string, resourceId: string): Promise<boolean> {
  const memory = getReadMemory();
  const thread = await memory.getThreadById({ threadId, resourceId });
  if (!thread) return false;
  await memory.deleteThread(threadId);
  await deleteContextUsage(threadId);
  return true;
}

// Deletes every thread bound to the given agent, project, issue or schedule, with its
// messages, and returns how many were deleted. Called when that binding goes away.
export async function deleteThreadsWhere(
  binding:
    { agentId: number } | { projectId: number } | { issueId: number } | { scheduleId: number },
): Promise<number> {
  const memory = getReadMemory();
  const { threads } = await memory.listThreads({ filter: { metadata: binding }, perPage: false });
  for (const thread of threads) {
    await memory.deleteThread(thread.id);
    await deleteContextUsage(thread.id);
  }
  return threads.length;
}

// One page of a user's chat threads with one agent, newest first. Scoped by resourceId
// (the caller) and the agent binding in metadata, so a caller only ever sees their
// own conversations with that agent.
export async function listChatThreads(
  resourceId: string,
  agentId: number,
  page = 0,
): Promise<ChatThreadPage> {
  const res = await getReadMemory().listThreads({
    filter: { resourceId, metadata: { agentId, kind: 'chat' } },
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    perPage: THREAD_PAGE_SIZE,
    page,
  });
  const sizes = await readContextTokens(res.threads.map((t) => t.id));
  const items = res.threads.map((t) => ({
    id: t.id,
    title: t.title && t.title.length > 0 ? t.title : null,
    cliSessionId: null,
    ...(sizes.has(t.id) ? { contextTokens: sizes.get(t.id) } : {}),
    createdAt: toIso(t.createdAt),
    updatedAt: toIso(t.updatedAt),
  }));
  return { items, nextPage: res.hasMore ? page + 1 : null };
}

// Loads the transcript of one chat thread for the given owner. Returns null when
// the thread does not exist or is not owned by resourceId (so the caller maps it to
// a 404). Messages come back oldest first.
export async function getChatThreadMessages(
  threadId: string,
  resourceId: string,
  page = 0,
): Promise<ChatMessagePage | null> {
  const memory = getReadMemory();
  const thread = await memory.getThreadById({ threadId, resourceId });
  if (!thread) return null;
  const { messages, hasMore } = await memory.recall({
    threadId,
    resourceId,
    page,
    perPage: 25,
    threadConfig: { lastMessages: false, semanticRecall: false },
    includeSystemReminders: false,
  });
  const out: ChatMessageDTO[] = [];
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const parts = messageParts(m.content);
    if (parts.length > 0) {
      out.push({ id: m.id, role: m.role, parts, createdAt: toIso(m.createdAt) });
    }
  }
  return { items: out, nextPage: hasMore ? page + 1 : null };
}

// As much of a stored Mastra v2 message part as the chat reads.
type StoredPart = {
  type?: unknown;
  text?: unknown;
  toolInvocation?: { toolCallId?: unknown; toolName?: unknown; args?: unknown; result?: unknown };
};

// Reads a Mastra v2 message into the parts the chat shows: its text and the tool calls
// it made, in the order they are stored. Falls back to the flat content string of a
// message kept without parts.
function messageParts(content: unknown): ChatPart[] {
  if (!content || typeof content !== 'object') return [];
  const { parts, content: flat } = content as { parts?: unknown; content?: unknown };
  const out: ChatPart[] = [];
  for (const part of Array.isArray(parts) ? parts : []) {
    if (!part || typeof part !== 'object') continue;
    const { type, text, toolInvocation } = part as StoredPart;
    if (type === 'text' && typeof text === 'string') {
      appendTextPart(out, text);
    } else if (type === 'tool-invocation' && typeof toolInvocation?.toolName === 'string') {
      out.push({
        type: 'tool',
        toolCallId: String(toolInvocation.toolCallId ?? ''),
        toolName: toolInvocation.toolName,
        args: toolArgsText(toolInvocation.args),
        result: toolText(toolInvocation.result),
      });
    }
  }
  if (out.length > 0) return out;
  return typeof flat === 'string' && flat ? [{ type: 'text', text: flat }] : [];
}
