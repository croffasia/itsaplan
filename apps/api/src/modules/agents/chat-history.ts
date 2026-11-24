import { db } from '@repo/db';
import { sql, type SQL } from 'drizzle-orm';
import { likePattern } from '#shared/lib';
import { toIso } from './core/helpers/dates';
import { getStore } from './core/runtime/store';
import { contextField, readContextSizes } from './chat-usage';
import type { AgentKind } from './core/service';
import type { ChatThreadPage, ChatThreadSummary } from './model';

// The chat history list. An external agent's conversations are kept in agent_chat_thread
// and an internal agent's in Mastra's tables, so the list reads the two as one: it may
// cover agents of both kinds. Mastra's tables are addressed in raw SQL, since its storage
// API searches no text and returns no snippet.
//
// The list has three shapes: the starred conversations, then the rest of them a page at
// a time — a starred one is in the group and not in the page, so it is shown once — and,
// while a search is typed, its hits over all of them.

const PAGE_SIZE = 25;

// Below this a search is not run: one character matches nearly every conversation.
const MIN_QUERY = 2;

// How much text is kept around the match, on each side, and the length that leaves.
const SNIPPET_RADIUS = 60;
const SNIPPET_LENGTH = SNIPPET_RADIUS * 2 + 40;

// What the history list is asked for: one page of the caller's conversations, the ones
// they starred (the favorites group, unpaginated), or the ones matching a search.
interface ThreadListOpts {
  page?: number;
  q?: string;
  favorites?: boolean;
}

// Where a hit came from. It is read as a rank as well: the title first, then the
// conversations where the member's own message matches, then the ones matching only in
// the agent's reply.
export type ThreadMatch = 'title' | 'user' | 'assistant';

function matchOfRank(rank: number): ThreadMatch {
  if (rank === 1) return 'title';
  if (rank === 2) return 'user';
  return 'assistant';
}

// The search term, or null when there is nothing to search for.
function searchTerm(q: string | undefined): string | null {
  const trimmed = q?.trim() ?? '';
  return trimmed.length >= MIN_QUERY ? trimmed : null;
}

// The stretch of text around the first match, cut in the database: an answer can be
// 100,000 characters and must not be read into the app to show 160 of them.
function snippetOf(text: SQL, term: string): SQL {
  return sql`substring(${text} from greatest(position(lower(${term}) in lower(${text})) - ${SNIPPET_RADIUS}, 1) for ${SNIPPET_LENGTH})`;
}

// One conversation as the list reads it. Each shape of the list knows the star of its rows
// without looking it up: the page leaves the starred ones out, the favorites group holds
// only those, and a search reads it per row.
interface ThreadRow {
  id: string;
  agentId: number;
  title: string | null;
  cliSessionId: string | null;
  favorite: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Set by a search: what matched, and the text around it.
  rank?: number;
  snippet?: string | null;
}

// Where conversations of one kind of agent are kept: the caller's own, with the agents
// asked about, and what a search matches in the messages of one of them, `t`.
interface ThreadStore {
  threads: SQL;
  hit: (term: string) => SQL;
}

const sqlList = (values: (string | number)[]) =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );

// A tool call is not searched: its arguments and its result are events of their own, and
// the message text holds only what the agent wrote.
const externalThreads = (userId: string, agentIds: number[]): ThreadStore => ({
  threads: sql`
    SELECT id, agent_id AS "agentId", title, cli_session_id AS "cliSessionId",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM agent_chat_thread
    WHERE user_id = ${userId} AND agent_id IN (${sqlList(agentIds)})`,
  hit: (term) => sql`
    SELECT bool_or(msg.role = 'user') AS user_match,
           (array_agg(${snippetOf(sql`msg.content`, term)} ORDER BY msg.id DESC))[1] AS snippet
    FROM agent_chat_message msg
    WHERE msg.thread_id = t.id AND msg.content ILIKE ${likePattern(term)}`,
});

// A thread is bound to its agent through the metadata written when it was created, and
// 'chat' is what tells a conversation apart from an autonomous run's thread. A message is
// stored as JSON, so its text parts are taken out one by one: matching the whole document
// would also match the arguments and the result of a tool call.
const internalThreads = (userId: string, agentIds: number[]): ThreadStore => ({
  threads: sql`
    SELECT id, (metadata->>'agentId')::int AS "agentId", title, NULL::text AS "cliSessionId",
           coalesce("createdAtZ", "createdAt" AT TIME ZONE 'UTC') AS "createdAt",
           coalesce("updatedAtZ", "updatedAt" AT TIME ZONE 'UTC') AS "updatedAt"
    FROM mastra_threads
    WHERE "resourceId" = ${userId}
      AND metadata->>'kind' = 'chat'
      AND metadata->>'agentId' IN (${sqlList(agentIds.map(String))})`,
  hit: (term) => sql`
    SELECT bool_or(msg.role = 'user') AS user_match,
           (array_agg(${snippetOf(sql`part->>'text'`, term)} ORDER BY msg."createdAt" DESC))[1]
             AS snippet
    FROM mastra_messages msg
    CROSS JOIN LATERAL jsonb_array_elements(msg.content::jsonb -> 'parts') AS part
    WHERE msg.thread_id = t.id
      AND part->>'type' = 'text'
      AND part->>'text' ILIKE ${likePattern(term)}`,
});

// A user's conversations with the given agents: the favorites group, the hits of a
// search, or one page of the rest of them, newest first.
export async function listThreads(
  userId: string,
  agents: { id: number; kind: AgentKind }[],
  { page = 0, q, favorites = false }: ThreadListOpts = {},
): Promise<ChatThreadPage> {
  const idsOf = (kind: AgentKind) =>
    agents.filter((agent) => agent.kind === kind).map((agent) => agent.id);
  const external = idsOf('external');
  const internal = idsOf('internal');
  const stores: ThreadStore[] = [];
  if (external.length > 0) stores.push(externalThreads(userId, external));
  if (internal.length > 0) {
    // Raw SQL skips Mastra's lazy init: an instance whose agents never ran has no tables.
    await getStore().init();
    stores.push(internalThreads(userId, internal));
  }
  if (stores.length === 0) return { items: [], nextPage: null };

  if (favorites) {
    return { items: await summarize(await favoriteThreads(userId, stores)), nextPage: null };
  }
  const term = searchTerm(q);
  const rows = term
    ? await searchThreads(userId, stores, term, page)
    : await unstarredThreads(userId, stores, page);
  return {
    items: await summarize(rows.slice(0, PAGE_SIZE)),
    nextPage: rows.length > PAGE_SIZE ? page + 1 : null,
  };
}

const unionOf = (parts: SQL[]) => sql`(${sql.join(parts, sql` UNION ALL `)}) t`;

// One row over the page tells whether there is another.
const pageOf = (page: number) => sql`LIMIT ${PAGE_SIZE + 1} OFFSET ${page * PAGE_SIZE}`;

async function readRows(query: SQL): Promise<ThreadRow[]> {
  return (await db.execute(query)) as unknown as ThreadRow[];
}

// One page of the conversations that are not starred, newest first. The starred ones are
// left out because the group above the list already holds them.
function unstarredThreads(userId: string, stores: ThreadStore[], page: number) {
  return readRows(sql`
    SELECT t.*, false AS favorite
    FROM ${unionOf(stores.map((store) => store.threads))}
    WHERE NOT EXISTS (
      SELECT 1 FROM agent_chat_favorite f WHERE f.user_id = ${userId} AND f.thread_id = t.id
    )
    ORDER BY t."updatedAt" DESC, t.id
    ${pageOf(page)}
  `);
}

// The conversations the caller starred, newest first, in one go.
function favoriteThreads(userId: string, stores: ThreadStore[]) {
  return readRows(sql`
    SELECT t.*, true AS favorite
    FROM ${unionOf(stores.map((store) => store.threads))}
    JOIN agent_chat_favorite f ON f.user_id = ${userId} AND f.thread_id = t.id
    ORDER BY t."updatedAt" DESC
  `);
}

// The conversations whose title or message text contains the term. The snippet is cut from
// the newest matching message, in the database. The rank puts a title hit first, then the
// ones where the member's own message matches, then the ones matching only in the agent's
// reply.
function searchThreads(userId: string, stores: ThreadStore[], term: string, page: number) {
  const like = likePattern(term);
  const searched = stores.map(
    (store) => sql`
      SELECT t.*, hit.user_match, hit.snippet
      FROM (${store.threads}) t
      LEFT JOIN LATERAL (${store.hit(term)}) hit ON true`,
  );
  return readRows(sql`
    SELECT t.*,
           f.thread_id IS NOT NULL AS favorite,
           CASE
             WHEN t.title ILIKE ${like} THEN 1
             WHEN coalesce(t.user_match, false) THEN 2
             ELSE 3
           END AS rank
    FROM ${unionOf(searched)}
    LEFT JOIN agent_chat_favorite f ON f.user_id = ${userId} AND f.thread_id = t.id
    WHERE t.title ILIKE ${like} OR t.snippet IS NOT NULL
    ORDER BY rank, t."updatedAt" DESC, t.id
    ${pageOf(page)}
  `);
}

// The conversations as the list returns them, with the context size of each.
async function summarize(rows: ThreadRow[]): Promise<ChatThreadSummary[]> {
  const sizes = await readContextSizes(rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
    agentId: row.agentId,
    title: row.title && row.title.length > 0 ? row.title : null,
    cliSessionId: row.cliSessionId,
    favorite: row.favorite,
    ...(row.rank != null ? { match: matchOfRank(row.rank) } : {}),
    ...(row.snippet ? { snippet: row.snippet } : {}),
    ...contextField(sizes, row.id),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }));
}
