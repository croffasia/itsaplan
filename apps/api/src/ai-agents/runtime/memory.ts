import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { db } from '@repo/db';
import { sql } from 'drizzle-orm';
import { toIso } from '../helpers/dates';

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
    title: title.slice(0, 80),
    metadata: meta,
    saveThread: true,
  });
}

// Deletes one of the caller's chat threads with its messages. Returns false when the
// thread does not exist or belongs to someone else, so the caller maps it to a 404.
export async function deleteChatThread(threadId: string, resourceId: string): Promise<boolean> {
  const memory = getReadMemory();
  const thread = await memory.getThreadById({ threadId, resourceId });
  if (!thread) return false;
  await memory.deleteThread(threadId);
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
  for (const thread of threads) await memory.deleteThread(thread.id);
  return threads.length;
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

export type ChatDashboardSummary = {
  generatedAt: string;
  threads: number;
  awaitingReply: number;
  messages24h: number;
  medianReplyMs7d: number | null;
  peak: { messages: number; hour: string };
  hourlyMessages: { hour: string; messages: number }[];
};

export async function getChatDashboardSummary(
  resourceId: string,
  projectId: number,
): Promise<ChatDashboardSummary> {
  await getReadMemory().listThreads({
    filter: { resourceId, metadata: { projectId, kind: 'chat' } },
    perPage: 1,
  });

  const [metricRows, hourlyRows] = await Promise.all([
    db.execute(sql`
      with chat_threads as (
        select id
        from mastra_threads
        where "resourceId" = ${resourceId}
          and metadata->>'projectId' = ${String(projectId)}
          and metadata->>'kind' = 'chat'
      ), all_threads as (
        select 'mastra:' || id as id from chat_threads
        union all
        select 'hermes:' || id::text
        from hermes_conversation
        where project_id = ${projectId}
          and created_by = ${resourceId}
          and status = 'active'
      ), all_messages as (
        select 'mastra:' || m.thread_id as thread_id, m.id::text as id, m.role, m."createdAt" as created_at
        from mastra_messages m
        inner join chat_threads t on t.id = m.thread_id
        where m.role in ('user', 'assistant')
        union all
        select 'hermes:' || c.id::text, m.id::text, m.role, m.created_at
        from hermes_message m
        inner join hermes_conversation c on c.id = m.conversation_id
        where c.project_id = ${projectId}
          and c.created_by = ${resourceId}
          and c.status = 'active'
          and m.role in ('user', 'assistant')
          and m.status <> 'pending'
      ), ordered_messages as (
        select
          m.thread_id, m.role, m.created_at,
          lag(m.role) over (partition by m.thread_id order by m.created_at, m.id) as previous_role,
          lag(m.created_at) over (
            partition by m.thread_id order by m.created_at, m.id
          ) as previous_created_at
        from all_messages m
      ), latest_messages as (
        select distinct on (thread_id) thread_id, role
        from ordered_messages
        order by thread_id, created_at desc
      )
      select
        (select count(*)::int from all_threads) as threads,
        (select count(*)::int from latest_messages where role = 'assistant') as "awaitingReply",
        (select count(*)::int from ordered_messages
          where created_at >= now() - interval '24 hours') as "messages24h",
        (select percentile_cont(0.5) within group (
          order by extract(epoch from (created_at - previous_created_at)) * 1000
        ) from ordered_messages
          where role = 'assistant'
            and previous_role = 'user'
            and created_at >= now() - interval '7 days') as "medianReplyMs7d"
    `),
    db.execute(sql`
      with hours as (
        select generate_series(
          date_trunc('hour', now()) - interval '23 hours',
          date_trunc('hour', now()),
          interval '1 hour'
        ) as bucket
      ), chat_threads as (
        select id
        from mastra_threads
        where "resourceId" = ${resourceId}
          and metadata->>'projectId' = ${String(projectId)}
          and metadata->>'kind' = 'chat'
      ), project_messages as (
        select m.id::text as id, m."createdAt" as created_at
        from mastra_messages m
        inner join chat_threads t on t.id = m.thread_id
        where m.role in ('user', 'assistant')
          and m."createdAt" >= date_trunc('hour', now()) - interval '23 hours'
        union all
        select m.id::text, m.created_at
        from hermes_message m
        inner join hermes_conversation c on c.id = m.conversation_id
        where c.project_id = ${projectId}
          and c.created_by = ${resourceId}
          and c.status = 'active'
          and m.role in ('user', 'assistant')
          and m.status <> 'pending'
          and m.created_at >= date_trunc('hour', now()) - interval '23 hours'
      )
      select h.bucket::text as hour, count(m.id)::int as messages
      from hours h
      left join project_messages m
        on m.created_at >= h.bucket and m.created_at < h.bucket + interval '1 hour'
      group by h.bucket
      order by h.bucket
    `),
  ]);

  const metric = (
    metricRows as unknown as {
      threads: number;
      awaitingReply: number;
      messages24h: number;
      medianReplyMs7d: number | null;
    }[]
  )[0] ?? { threads: 0, awaitingReply: 0, messages24h: 0, medianReplyMs7d: null };
  const hourlyMessages = (hourlyRows as unknown as { hour: string; messages: number }[]).map(
    (row) => ({
      hour: new Date(row.hour).toISOString(),
      messages: Number(row.messages),
    }),
  );
  const peak = hourlyMessages.reduce(
    (current, row) => (row.messages > current.messages ? row : current),
    hourlyMessages[0] ?? { hour: new Date().toISOString(), messages: 0 },
  );

  return {
    generatedAt: new Date().toISOString(),
    threads: Number(metric.threads),
    awaitingReply: Number(metric.awaitingReply),
    messages24h: Number(metric.messages24h),
    medianReplyMs7d:
      metric.medianReplyMs7d == null ? null : Math.round(Number(metric.medianReplyMs7d)),
    peak: { hour: peak.hour, messages: peak.messages },
    hourlyMessages,
  };
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
