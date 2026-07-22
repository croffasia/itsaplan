import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { toIso } from '../helpers/dates';

// Conversation memory for internal agents. Threads and their messages are
// persisted in a Postgres-backed store (Mastra manages its own tables), reusing
// DATABASE_URL. When an agent has memory enabled, a run recalls the last N
// messages of the given thread. Only the recency window is used (no semantic
// recall), so no vector store is required.
//
// A chat thread carries metadata that binds it to the agent and project it belongs
// to (agentId, projectId, kind: "chat"), set when the thread is first created. This
// lets the chat UI list a user's own past conversations with one agent: the thread's
// resourceId is the caller's user id, so filtering by (resourceId, agentId) returns
// exactly that user's threads with that agent. Threads created by issue-triggered
// runs carry no such metadata and are owned by the agent bot, so they never appear.

// Default recency window when an agent has memory enabled but no count set.
export const DEFAULT_LAST_MESSAGES = 20;

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

// Metadata written on a chat thread when it is created. `kind: "chat"` marks the
// thread as a UI conversation (as opposed to an issue-triggered run thread).
type ChatThreadMeta = { agentId: number; projectId: number; kind: 'chat' };

// Creates the chat thread up front with its agent/project binding and an initial
// title (the first prompt, truncated). Called only when a new chat thread starts,
// so continuing an existing thread does not overwrite its metadata or title.
export async function createChatThread(
  threadId: string,
  resourceId: string,
  meta: { agentId: number; projectId: number },
  title: string,
): Promise<void> {
  await getReadMemory().createThread({
    threadId,
    resourceId,
    title: title.slice(0, 80),
    metadata: {
      agentId: meta.agentId,
      projectId: meta.projectId,
      kind: 'chat',
    } satisfies ChatThreadMeta,
    saveThread: true,
  });
}

// One chat thread in the history list.
export type ChatThreadSummary = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

// Lists a user's chat threads with one agent, newest first. Scoped by resourceId
// (the caller) and the agent binding in metadata, so a caller only ever sees their
// own conversations with that agent.
export async function listChatThreads(
  resourceId: string,
  agentId: number,
): Promise<ChatThreadSummary[]> {
  const res = await getReadMemory().listThreads({
    filter: { resourceId, metadata: { agentId, kind: 'chat' } },
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    perPage: false,
  });
  return res.threads.map((t) => ({
    id: t.id,
    title: t.title && t.title.length > 0 ? t.title : null,
    createdAt: toIso(t.createdAt),
    updatedAt: toIso(t.updatedAt),
  }));
}

// One message in a restored conversation. Only user and assistant turns are
// returned; tool and system messages are omitted (the UI shows text, not the raw
// tool traffic).
export type ChatMessageDTO = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
};

export type ChatMessagePage = {
  items: ChatMessageDTO[];
  nextPage: number | null;
};

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
    const text = messageText(m.content);
    if (text) out.push({ id: m.id, role: m.role, text, createdAt: toIso(m.createdAt) });
  }
  return { items: out, nextPage: hasMore ? page + 1 : null };
}

// Extracts the plain text of a Mastra v2 message: the concatenation of its text
// parts, falling back to the flat content string.
function messageText(content: unknown): string {
  if (content && typeof content === 'object') {
    const parts = (content as { parts?: unknown }).parts;
    if (Array.isArray(parts)) {
      const text = parts
        .filter(
          (p): p is { type: string; text: string } =>
            !!p &&
            typeof p === 'object' &&
            (p as { type?: unknown }).type === 'text' &&
            typeof (p as { text?: unknown }).text === 'string',
        )
        .map((p) => p.text)
        .join('');
      if (text) return text;
    }
    const flat = (content as { content?: unknown }).content;
    if (typeof flat === 'string') return flat;
  }
  return '';
}
