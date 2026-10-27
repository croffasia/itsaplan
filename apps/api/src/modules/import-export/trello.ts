import { db, projectMember, user } from '@repo/db';
import { and, eq, inArray } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import { pinnedFetch } from '#shared/net';

// The Trello side of import jobs: checking an API key and token, listing the boards
// they can see, previewing a board's lists and members, and validating a job's
// Trello fields. Trello's endpoint is fixed, so no user-supplied URL is ever
// fetched. The worker's own reader is apps/worker/src/trello-adapter.ts; the api
// does not depend on the worker, so the small list mapping below is repeated here,
// as Plane's and Linear's are.

export const TRELLO_API_URL = 'https://api.trello.com/1';

type StateCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
export type TrelloFetch = typeof pinnedFetch;

// Trello keys and tokens are letters and digits. Anything else would break out of
// the quoted Authorization header they are sent in.
const TOKEN_CHARS = /^[A-Za-z0-9]+$/;

export interface TrelloCredentialInput {
  apiKey: string;
  apiToken: string;
}

export interface TrelloBoardOption {
  id: string;
  name: string;
  closed: boolean;
}

export interface TrelloStateOption {
  id: string;
  name: string;
  category: StateCategory;
}

export interface TrelloMemberOption {
  id: string;
  fullName: string;
  username: string;
}

export interface CreateTrelloImportJobInput extends TrelloCredentialInput {
  source: 'trello';
  boardId: string;
  archivedCards: 'archive' | 'skip';
  memberMap?: Record<string, string>;
}

// Mirrors trelloListCategory in apps/worker/src/trello-mapping.ts.
function listCategory(name: string): StateCategory {
  if (/\b(done|completed?|finished|closed|shipped|released)\b/i.test(name)) return 'completed';
  if (/\b(doing|in progress|wip|review|testing|qa)\b/i.test(name)) return 'started';
  if (/\b(backlog|ideas?|icebox|someday)\b/i.test(name)) return 'backlog';
  return 'unstarted';
}

function credentialOf(input: TrelloCredentialInput): { apiKey: string; token: string } {
  const apiKey = input.apiKey.trim();
  const token = input.apiToken.trim();
  if (!apiKey) throw new HttpError(400, 'apiKey is required');
  if (!token) throw new HttpError(400, 'apiToken is required');
  if (!TOKEN_CHARS.test(apiKey)) throw new HttpError(400, 'apiKey is not a Trello API key');
  if (!TOKEN_CHARS.test(token)) throw new HttpError(400, 'apiToken is not a Trello token');
  return { apiKey, token };
}

function boardIdOf(raw: string): string {
  const boardId = raw.trim();
  if (!boardId) throw new HttpError(400, 'boardId is required');
  if (!TOKEN_CHARS.test(boardId)) throw new HttpError(400, 'boardId is not a Trello board id');
  return boardId;
}

async function trelloGet<T>(
  credential: { apiKey: string; token: string },
  path: string,
  params: Record<string, string>,
  fetch: TrelloFetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${TRELLO_API_URL}${path}?${new URLSearchParams(params)}`, {
      headers: {
        Authorization: `OAuth oauth_consumer_key="${credential.apiKey}", oauth_token="${credential.token}"`,
      },
      timeoutMs: 15_000,
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, 'Trello could not be reached.');
  }
  if (response.status === 401) throw new HttpError(400, 'Trello rejected the API key or token.');
  if (response.status === 429) {
    throw new HttpError(502, "Trello's rate limit was reached. Try again in a few minutes.");
  }
  // A malformed or unknown board id.
  if (response.status === 400 || response.status === 404) {
    throw new HttpError(400, 'Trello board not found.');
  }
  if (!response.ok)
    throw new HttpError(502, `Trello request failed with status ${response.status}.`);
  return (await response.json()) as T;
}

// Confirms the key and token work before anything is stored, and returns every board
// they can see, open boards first. Closed boards are listed too: an archive import
// wants them.
export async function testTrelloConnection(
  input: TrelloCredentialInput,
  fetch: TrelloFetch = pinnedFetch,
): Promise<{ boards: TrelloBoardOption[] }> {
  const boards = await trelloGet<TrelloBoardOption[]>(
    credentialOf(input),
    '/members/me/boards',
    { filter: 'all', fields: 'name,closed' },
    fetch,
  );
  return {
    boards: boards
      .map((b) => ({ id: b.id, name: b.name, closed: b.closed }))
      .sort((a, b) => Number(a.closed) - Number(b.closed) || a.name.localeCompare(b.name)),
  };
}

// A board's open lists in Trello's order, each with the category the import would
// map it to, and the board's members to match with project members.
export async function previewTrelloBoard(
  input: TrelloCredentialInput & { boardId: string },
  fetch: TrelloFetch = pinnedFetch,
): Promise<{ states: TrelloStateOption[]; members: TrelloMemberOption[] }> {
  const credential = credentialOf(input);
  const board = `/boards/${boardIdOf(input.boardId)}`;
  const lists = await trelloGet<{ id: string; name: string; pos: number }[]>(
    credential,
    `${board}/lists`,
    { filter: 'open', fields: 'name,pos' },
    fetch,
  );
  const members = await trelloGet<TrelloMemberOption[]>(
    credential,
    `${board}/members`,
    { fields: 'fullName,username' },
    fetch,
  );
  return {
    states: [...lists]
      .sort((a, b) => a.pos - b.pos)
      .map((l) => ({ id: l.id, name: l.name, category: listCategory(l.name) })),
    members: members.map((m) => ({ id: m.id, fullName: m.fullName, username: m.username })),
  };
}

// The worker matches people by email, so each Trello member the user matched is
// stored with the email of that project member. Only a member of this project can
// be matched.
async function memberEmails(
  projectId: number,
  memberMap: Record<string, string>,
): Promise<Record<string, string>> {
  const entries = Object.entries(memberMap).filter(([, userId]) => userId.trim() !== '');
  if (entries.length === 0) return {};
  for (const [memberId] of entries) {
    if (!TOKEN_CHARS.test(memberId)) {
      throw new HttpError(400, 'memberMap names a Trello member id that is not valid');
    }
  }
  const userIds = [...new Set(entries.map(([, userId]) => userId))];
  const rows = await db
    .select({ userId: user.id, email: user.email })
    .from(projectMember)
    .innerJoin(user, eq(user.id, projectMember.userId))
    .where(and(eq(projectMember.projectId, projectId), inArray(projectMember.userId, userIds)));
  const emailOf = new Map(rows.map((r) => [r.userId, r.email]));
  return Object.fromEntries(
    entries.map(([memberId, userId]) => {
      const email = emailOf.get(userId);
      if (!email) throw new HttpError(400, 'memberMap names someone who is not in this project');
      return [memberId, email];
    }),
  );
}

// What createImportJob stores for a Trello job: the credential and config the
// worker's import-sources.ts reads back.
export async function trelloJobFields(projectId: number, input: CreateTrelloImportJobInput) {
  const credential = credentialOf(input);
  const boardId = boardIdOf(input.boardId);
  const emails = await memberEmails(projectId, input.memberMap ?? {});
  return {
    source: 'trello' as const,
    credential,
    config: {
      boardId,
      archivedCards: input.archivedCards,
      ...(Object.keys(emails).length > 0 ? { memberEmails: emails } : {}),
    },
  };
}
