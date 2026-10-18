import { describe, it, expect } from 'bun:test';
import type { PinnedRequestInit } from '@repo/net';
import { HttpError } from '#shared/lib';
import { previewJiraStates, testJiraConnection, type JiraFetch } from '../../jira';
import { previewTrelloStates, testTrelloConnection } from '../../trello';

interface SentRequest {
  url: string;
  init: PinnedRequestInit | undefined;
}

function answering(responses: Response[], sent: SentRequest[] = []): JiraFetch {
  const queue = [...responses];
  return async (url, init) => {
    sent.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    return next;
  };
}

const JIRA = { baseUrl: 'https://acme.atlassian.net', email: 'a@x.com', apiToken: 'tok' };
const TRELLO = { apiKey: 'key', token: 'tok' };

async function httpError(promise: Promise<unknown>): Promise<HttpError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpError);
  return error as HttpError;
}

describe('testJiraConnection', () => {
  it('checks the account, then pages the projects, sorted by name', async () => {
    const sent: SentRequest[] = [];
    const result = await testJiraConnection(
      JIRA,
      answering(
        [
          Response.json({ accountId: '1' }),
          Response.json({ values: [{ id: '2', key: 'WEB', name: 'Web' }], isLast: false }),
          Response.json({ values: [{ id: '1', key: 'API', name: 'Api' }], isLast: true }),
        ],
        sent,
      ),
    );
    expect(result.projects.map((p) => p.key)).toEqual(['API', 'WEB']);
    expect(sent.map((r) => new URL(r.url).pathname + new URL(r.url).search)).toEqual([
      '/rest/api/3/myself',
      '/rest/api/3/project/search?maxResults=50&startAt=0',
      '/rest/api/3/project/search?maxResults=50&startAt=1',
    ]);
    expect((sent[0]!.init?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${btoa('a@x.com:tok')}`,
    );
  });

  it('answers 400 for a rejected token', async () => {
    const error = await httpError(
      testJiraConnection(JIRA, answering([new Response('', { status: 401 })])),
    );
    expect(error.status).toBe(400);
  });
});

describe('previewJiraStates', () => {
  it('lists each status once with its category', async () => {
    const status = (id: string, name: string, key: string) => ({
      id,
      name,
      statusCategory: { key },
    });
    const result = await previewJiraStates(
      { ...JIRA, jiraProjectKey: 'OPS' },
      answering([
        Response.json([
          { statuses: [status('1', 'To Do', 'new'), status('2', 'Done', 'done')] },
          { statuses: [status('1', 'To Do', 'new'), status('3', 'Cancelled', 'done')] },
        ]),
      ]),
    );
    expect(result.states).toEqual([
      { id: '1', name: 'To Do', category: 'unstarted' },
      { id: '2', name: 'Done', category: 'completed' },
      { id: '3', name: 'Cancelled', category: 'canceled' },
    ]);
  });
});

describe('Trello', () => {
  it('lists boards with the OAuth header', async () => {
    const sent: SentRequest[] = [];
    const result = await testTrelloConnection(
      TRELLO,
      answering(
        [
          Response.json([
            { id: 'b', name: 'Zeta', closed: true },
            { id: 'a', name: 'Alpha', closed: false },
          ]),
        ],
        sent,
      ),
    );
    expect(result.boards.map((b) => b.id)).toEqual(['a', 'b']);
    expect(sent[0]!.url).toBe(
      'https://api.trello.com/1/members/me/boards?filter=all&fields=name,closed',
    );
    expect((sent[0]!.init?.headers as Record<string, string>).Authorization).toBe(
      'OAuth oauth_consumer_key="key", oauth_token="tok"',
    );
  });

  it('maps list names to categories', async () => {
    const result = await previewTrelloStates(
      { ...TRELLO, trelloBoardId: 'b' },
      answering([
        Response.json([
          { id: '1', name: 'Doing' },
          { id: '2', name: 'Done' },
          { id: '3', name: 'Next' },
        ]),
      ]),
    );
    expect(result.states.map((s) => s.category)).toEqual(['started', 'completed', 'unstarted']);
  });

  it('answers 400 for a rejected token', async () => {
    const error = await httpError(
      testTrelloConnection(TRELLO, answering([new Response('', { status: 401 })])),
    );
    expect(error.status).toBe(400);
  });
});
