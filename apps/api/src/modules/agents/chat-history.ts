import { sql, type SQL } from 'drizzle-orm';
import { toIso } from './core/helpers/dates';
import { contextField, readContextSizes } from './chat-usage';
import type { ChatThreadSummary } from './model';

// The chat history list, as far as both stores build it the same way. An external
// agent's conversations are read from agent_chat_thread and an internal agent's from
// Mastra's tables, but they are searched by the same rules, ranked the same way, and
// come back as the same summaries.
//
// The list has three shapes: the starred conversations, then the rest of them a page at
// a time — a starred one is in the group and not in the page, so it is shown once — and,
// while a search is typed, its hits over all of them.

// Below this a search is not run: one character matches nearly every conversation.
const MIN_QUERY = 2;

// How much text is kept around the match, on each side, and the length that leaves.
const SNIPPET_RADIUS = 60;
const SNIPPET_LENGTH = SNIPPET_RADIUS * 2 + 40;

// What the history list is asked for: one page of the caller's conversations with the
// agent, the ones they starred (the favorites group, unpaginated), or the ones matching
// a search.
export type ThreadListOpts = {
  page?: number;
  q?: string;
  favorites?: boolean;
};

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
export function searchTerm(q: string | undefined): string | null {
  const trimmed = q?.trim() ?? '';
  return trimmed.length >= MIN_QUERY ? trimmed : null;
}

// The ILIKE pattern for the term. The wildcards a member types are escaped, so a query
// with a % in it looks for that character.
export function likePattern(term: string): string {
  return `%${term.replace(/([\\%_])/g, '\\$1')}%`;
}

// The stretch of text around the first match, cut in the database: an answer can be
// 100,000 characters and must not be read into the app to show 160 of them.
export function snippetOf(text: SQL, term: string): SQL {
  return sql`substring(${text} from greatest(position(lower(${term}) in lower(${text})) - ${SNIPPET_RADIUS}, 1) for ${SNIPPET_LENGTH})`;
}

// One conversation as the two stores read it, before the parts every list adds. Each
// list knows the star of its rows without looking it up: the page leaves the starred
// ones out, the favorites group holds only those, and a search reads it per row.
export interface ThreadRow {
  id: string;
  title: string | null;
  cliSessionId: string | null;
  favorite: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Set by a search: what matched, and the text around it.
  rank?: number;
  snippet?: string | null;
}

// The conversations as the list returns them, with the context size of each.
export async function summarize(rows: ThreadRow[]): Promise<ChatThreadSummary[]> {
  const sizes = await readContextSizes(rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
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
