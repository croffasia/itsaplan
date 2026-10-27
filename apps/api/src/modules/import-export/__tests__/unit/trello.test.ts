import { describe, it, expect } from 'bun:test';
import type { PinnedRequestInit } from '@repo/net';
import { HttpError } from '#shared/lib';
import {
  TRELLO_API_URL,
  previewTrelloBoard,
  testTrelloConnection,
  type TrelloFetch,
} from '../../trello';

interface SentRequest {
  url: string;
  init: PinnedRequestInit | undefined;
}

const CREDENTIAL = { apiKey: ' trellokey1 ', apiToken: ' ATTAtoken1 ' };
const AUTH = 'OAuth oauth_consumer_key="trellokey1", oauth_token="ATTAtoken1"';

function answering(responses: (Response | Error)[], sent: SentRequest[] = []): TrelloFetch {
  const queue = [...responses];
  return async (url, init) => {
    sent.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    if (next instanceof Error) throw next;
    return next;
  };
}

async function httpError(promise: Promise<unknown>): Promise<HttpError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpError);
  return error as HttpError;
}

describe('testTrelloConnection', () => {
  it('sends the trimmed key and token to Trello only and lists open boards first', async () => {
    const sent: SentRequest[] = [];
    const fetch = answering(
      [
        Response.json([
          { id: 'b3', name: 'Archive', closed: true },
          { id: 'b2', name: 'Roadmap', closed: false },
          { id: 'b1', name: 'Bugs', closed: false },
        ]),
      ],
      sent,
    );

    expect(await testTrelloConnection(CREDENTIAL, fetch)).toEqual({
      boards: [
        { id: 'b1', name: 'Bugs', closed: false },
        { id: 'b2', name: 'Roadmap', closed: false },
        { id: 'b3', name: 'Archive', closed: true },
      ],
    });
    expect(sent).toEqual([
      {
        url: `${TRELLO_API_URL}/members/me/boards?filter=all&fields=name%2Cclosed`,
        init: { headers: { Authorization: AUTH }, timeoutMs: 15_000 },
      },
    ]);
  });

  it.each([
    ['an empty key', { apiKey: ' ', apiToken: 'ATTAtoken1' }, 'apiKey is required'],
    [
      'a key with a quote',
      { apiKey: 'key"x', apiToken: 'ATTAtoken1' },
      'apiKey is not a Trello API key',
    ],
    ['a token with a comma', { apiKey: 'key', apiToken: 'a,b' }, 'apiToken is not a Trello token'],
  ])('refuses %s before calling Trello', async (_case, input, message) => {
    const error = await httpError(testTrelloConnection(input, answering([])));
    expect(error.status).toBe(400);
    expect(error.message).toBe(message);
  });

  it.each([
    [401, 400, 'Trello rejected the API key or token.'],
    [429, 502, "Trello's rate limit was reached. Try again in a few minutes."],
    [500, 502, 'Trello request failed with status 500.'],
  ])('answers Trello HTTP %d with %d', async (status, expected, message) => {
    const error = await httpError(
      testTrelloConnection(CREDENTIAL, answering([new Response('', { status })])),
    );
    expect(error.status).toBe(expected);
    expect(error.message).toBe(message);
  });

  it('answers 502 when Trello cannot be reached', async () => {
    const error = await httpError(
      testTrelloConnection(CREDENTIAL, answering([new Error('ECONNRESET')])),
    );
    expect(error.status).toBe(502);
  });
});

describe('previewTrelloBoard', () => {
  it("returns the board's open lists in order with their category, and its members", async () => {
    const sent: SentRequest[] = [];
    const fetch = answering(
      [
        Response.json([
          { id: 'l2', name: 'Done', pos: 2 },
          { id: 'l1', name: 'To Do', pos: 1 },
        ]),
        Response.json([{ id: 'm1', fullName: 'Ada Lovelace', username: 'ada' }]),
      ],
      sent,
    );

    expect(await previewTrelloBoard({ ...CREDENTIAL, boardId: 'board1' }, fetch)).toEqual({
      states: [
        { id: 'l1', name: 'To Do', category: 'unstarted' },
        { id: 'l2', name: 'Done', category: 'completed' },
      ],
      members: [{ id: 'm1', fullName: 'Ada Lovelace', username: 'ada' }],
    });
    expect(sent.map((r) => r.url)).toEqual([
      `${TRELLO_API_URL}/boards/board1/lists?filter=open&fields=name%2Cpos`,
      `${TRELLO_API_URL}/boards/board1/members?fields=fullName%2Cusername`,
    ]);
  });

  it('refuses a board id that is not a Trello id before calling Trello', async () => {
    const error = await httpError(
      previewTrelloBoard({ ...CREDENTIAL, boardId: '../members/me' }, answering([])),
    );
    expect(error.status).toBe(400);
  });

  it('answers 400 for a board Trello does not know', async () => {
    const error = await httpError(
      previewTrelloBoard(
        { ...CREDENTIAL, boardId: 'board1' },
        answering([new Response('board not found', { status: 404 })]),
      ),
    );
    expect(error.status).toBe(400);
    expect(error.message).toBe('Trello board not found.');
  });
});
