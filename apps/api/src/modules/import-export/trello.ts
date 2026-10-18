import { HttpError } from '#shared/lib';
import { pinnedFetch } from '#shared/net';

// The Trello side of import jobs: checking an API key and token, listing the
// boards they can see, previewing a board's lists as states, and validating a
// job's Trello fields. Trello's endpoint is fixed; the key and token go in the
// OAuth Authorization header. The worker's reader is apps/worker/src/trello-adapter.ts;
// the list-name mapping is repeated here.

type StateCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
export type TrelloFetch = typeof pinnedFetch;

export const TRELLO_API_URL = 'https://api.trello.com/1';

export interface TrelloConnectionInput {
  apiKey: string;
  token: string;
}

export interface CreateTrelloImportJobInput extends TrelloConnectionInput {
  source: 'trello';
  trelloBoardId: string;
}

const CATEGORY_PATTERNS: [RegExp, StateCategory][] = [
  [/cancel|won'?t do|rejected|abandon/i, 'canceled'],
  [/done|complete|finished|closed|shipped|released/i, 'completed'],
  [/doing|progress|review|testing|\bqa\b|active|working/i, 'started'],
  [/backlog|ideas?|icebox|someday/i, 'backlog'],
];

function listCategory(name: string): StateCategory {
  return CATEGORY_PATTERNS.find(([pattern]) => pattern.test(name))?.[1] ?? 'unstarted';
}

function connection(input: TrelloConnectionInput): TrelloConnectionInput {
  const apiKey = input.apiKey.trim();
  const token = input.token.trim();
  if (!apiKey) throw new HttpError(400, 'apiKey is required');
  if (!token) throw new HttpError(400, 'token is required');
  // Both are interpolated into a quoted header value.
  if (/["\\\s]/.test(apiKey + token)) throw new HttpError(400, 'Trello rejected the key or token.');
  return { apiKey, token };
}

async function trelloGet<T>(
  input: TrelloConnectionInput,
  path: string,
  fetch: TrelloFetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${TRELLO_API_URL}${path}`, {
      headers: {
        Authorization: `OAuth oauth_consumer_key="${input.apiKey}", oauth_token="${input.token}"`,
        Accept: 'application/json',
      },
      timeoutMs: 15_000,
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, 'Trello could not be reached.');
  }
  if (response.status === 401) throw new HttpError(400, 'Trello rejected the key or token.');
  if (response.status === 400 || response.status === 404) {
    throw new HttpError(400, 'Trello board not found.');
  }
  if (response.status === 429) {
    throw new HttpError(502, "Trello's rate limit was reached. Try again in a few minutes.");
  }
  if (!response.ok)
    throw new HttpError(502, `Trello request failed with status ${response.status}.`);
  return (await response.json()) as T;
}

// Every board the token's member can see, closed ones included.
export async function testTrelloConnection(
  raw: TrelloConnectionInput,
  fetch: TrelloFetch = pinnedFetch,
): Promise<{ boards: { id: string; name: string; closed: boolean }[] }> {
  const input = connection(raw);
  const boards = await trelloGet<{ id: string; name: string; closed: boolean }[]>(
    input,
    '/members/me/boards?filter=all&fields=name,closed',
    fetch,
  );
  return {
    boards: boards
      .map((b) => ({ id: b.id, name: b.name, closed: b.closed }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function previewTrelloStates(
  raw: TrelloConnectionInput & { trelloBoardId: string },
  fetch: TrelloFetch = pinnedFetch,
): Promise<{ states: { id: string; name: string; category: StateCategory }[] }> {
  const input = connection(raw);
  const lists = await trelloGet<{ id: string; name: string }[]>(
    input,
    `/boards/${encodeURIComponent(boardId(raw.trelloBoardId))}/lists?filter=all&fields=name`,
    fetch,
  );
  return { states: lists.map((l) => ({ id: l.id, name: l.name, category: listCategory(l.name) })) };
}

function boardId(raw: string): string {
  const id = raw.trim();
  if (!id) throw new HttpError(400, 'trelloBoardId is required');
  return id;
}

// What createImportJob stores for a Trello job; apps/worker/src/import-sources.ts reads it back.
export function trelloJobFields(input: CreateTrelloImportJobInput) {
  return {
    source: 'trello' as const,
    credential: connection(input),
    config: { trelloBoardId: boardId(input.trelloBoardId) },
  };
}
