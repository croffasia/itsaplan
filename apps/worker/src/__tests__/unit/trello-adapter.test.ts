import { describe, it, expect } from 'bun:test';
import type { PinnedRequestInit } from '@repo/net';
import { AttachmentRejectedError } from '../../attachment-download';
import { SourceRateLimitedError } from '../../reader';
import {
  TRELLO_API_URL,
  TrelloReader,
  trelloAuthorization,
  trelloFileHeaders,
} from '../../trello-adapter';
import type { TrelloCard, TrelloScope } from '../../trello-mapping';

const CREDENTIAL = { apiKey: 'trellokey1', token: 'ATTAtoken1' };
const AUTH = { Authorization: 'OAuth oauth_consumer_key="trellokey1", oauth_token="ATTAtoken1"' };
const SCOPE: TrelloScope = { boardId: 'board-1', archivedCards: 'skip', memberEmails: {} };
const UPLOAD = 'https://trello.com/1/cards/card-1/attachments/a1/download/shot.png';
const SIGNED = 'https://storage.example.test/bucket/shot.png?signature=abc';

interface SentRequest {
  url: string;
  init: PinnedRequestInit | undefined;
}

function readerAnswering(responses: Response[], sent: SentRequest[] = [], scope = SCOPE) {
  const queue = [...responses];
  return new TrelloReader(CREDENTIAL, scope, async (url, init) => {
    sent.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    return next;
  });
}

function card(id: string, overrides: Partial<TrelloCard> = {}): TrelloCard {
  return {
    id,
    idShort: 1,
    name: id,
    desc: '',
    closed: false,
    idList: 'list-1',
    pos: 1,
    idLabels: [],
    idMembers: [],
    start: null,
    due: null,
    dateLastActivity: '2026-02-03T04:05:06.000Z',
    shortUrl: `https://trello.com/c/${id}`,
    attachments: [],
    ...overrides,
  };
}

const LISTS = [{ id: 'list-1', name: 'To Do', closed: false, pos: 1 }];

describe('TrelloReader requests', () => {
  it('sends the key and token in the Authorization header to the Trello API only', async () => {
    const sent: SentRequest[] = [];
    const reader = readerAnswering(
      [Response.json([{ id: 'l1', name: 'Bug', color: 'red' }])],
      sent,
    );

    expect(await reader.listLabels()).toEqual([{ sourceId: 'l1', name: 'Bug', color: '#eb5a46' }]);
    expect(sent).toEqual([
      {
        url: `${TRELLO_API_URL}/boards/board-1/labels?fields=name%2Ccolor&limit=1000`,
        init: { headers: AUTH, timeoutMs: 15_000 },
      },
    ]);
  });

  it('reads every card in pages of 1000 and returns them in one page', async () => {
    const sent: SentRequest[] = [];
    const firstPage = Array.from({ length: 1000 }, (_, i) =>
      card(`65000000${String(1000 + i).padStart(16, '0')}`, { pos: i }),
    );
    const reader = readerAnswering(
      [
        Response.json(firstPage),
        Response.json([card('64000000aaaaaaaaaaaaaaaa', { pos: 5000 })]),
        Response.json(LISTS),
        Response.json([]),
      ],
      sent,
    );

    const page = await reader.listIssues();

    expect(page.cursor).toBeNull();
    expect(page.items).toHaveLength(1001);
    const second = new URL(sent[1]!.url);
    expect(second.pathname).toBe('/1/boards/board-1/cards');
    expect(second.searchParams.get('filter')).toBe('open');
    expect(second.searchParams.get('before')).toBe('650000000000000000001000');
  });

  it('asks for archived cards too when they are imported archived', async () => {
    const sent: SentRequest[] = [];
    const reader = readerAnswering(
      [Response.json([]), Response.json(LISTS), Response.json([])],
      sent,
      { ...SCOPE, archivedCards: 'archive' },
    );
    await reader.listIssues();
    expect(new URL(sent[0]!.url).searchParams.get('filter')).toBe('all');
  });

  it('waits out a rate limit and fails on any other error', async () => {
    await expect(
      readerAnswering([new Response('', { status: 429 })]).listLabels(),
    ).rejects.toBeInstanceOf(SourceRateLimitedError);
    await expect(readerAnswering([new Response('', { status: 401 })]).listLabels()).rejects.toThrow(
      'Trello request failed: HTTP 401',
    );
  });

  it('links a card to another card of the same board only', async () => {
    const linked = (shortLink: string) => ({
      id: `link-${shortLink}`,
      name: `https://trello.com/c/${shortLink}`,
      url: `https://trello.com/c/${shortLink}/2-title`,
      isUpload: false,
      bytes: null,
      mimeType: null,
    });
    const reader = readerAnswering([
      Response.json(
        card('card-1', {
          attachments: [linked('Same1'), linked('Other1'), linked('Gone1'), linked('zz')],
        }),
      ),
      Response.json({ id: 'card-2', idBoard: 'board-1' }),
      Response.json({ id: 'card-3', idBoard: 'board-other' }),
      new Response('Card not found', { status: 404 }),
      new Response('invalid id', { status: 400 }),
    ]);

    expect(await reader.listIssueRelations('card-1')).toEqual([
      { kind: 'relates', sourceIssueSourceId: 'card-1', targetIssueSourceId: 'card-2' },
    ]);
  });

  it('pages comments before the oldest one and returns them oldest first', async () => {
    const sent: SentRequest[] = [];
    const comment = (id: string, date: string) => ({
      id,
      date,
      idMemberCreator: 'm1',
      data: { text: id },
      memberCreator: { fullName: 'Ada', username: 'ada' },
    });
    const full = Array.from({ length: 1000 }, (_, i) =>
      comment(`66000000${String(1000 + i).padStart(16, '0')}`, '2026-02-02T00:00:00.000Z'),
    );
    const reader = readerAnswering(
      [
        Response.json(full),
        Response.json([comment('65000000aaaaaaaaaaaaaaaa', '2026-01-01T00:00:00.000Z')]),
      ],
      sent,
    );

    const comments = await reader.listIssueComments('card-1');

    expect(comments).toHaveLength(1001);
    expect(comments[0]!.sourceId).toBe('65000000aaaaaaaaaaaaaaaa');
    expect(new URL(sent[1]!.url).searchParams.get('before')).toBe('660000000000000000001000');
  });
});

describe('resolveAttachmentDownload', () => {
  const withUpload = () =>
    Response.json(
      card('card-1', {
        attachments: [
          {
            id: 'a1',
            name: 'shot.png',
            url: UPLOAD,
            isUpload: true,
            bytes: 10,
            mimeType: 'image/png',
          },
        ],
      }),
    );

  it('follows the redirect to storage and never sends the key and token past Trello', async () => {
    const sent: SentRequest[] = [];
    const reader = readerAnswering(
      [
        withUpload(),
        new Response(null, { status: 302, headers: { location: SIGNED } }),
        new Response('', { status: 200 }),
      ],
      sent,
    );

    expect(await reader.resolveAttachmentDownload('card-1', 'a1')).toStrictEqual({ url: SIGNED });
    expect(sent.slice(1).map((r) => [r.url, r.init?.headers])).toEqual([
      [UPLOAD, AUTH],
      [SIGNED, undefined],
    ]);
  });

  it('skips a file that is no longer on the card', async () => {
    const reader = readerAnswering([withUpload()]);
    await expect(reader.resolveAttachmentDownload('card-1', 'gone')).rejects.toBeInstanceOf(
      AttachmentRejectedError,
    );
  });
});

describe('trelloFileHeaders', () => {
  it('gives the key and token to Trello hosts over https only', () => {
    expect(trelloFileHeaders(UPLOAD, CREDENTIAL)).toEqual(AUTH);
    expect(trelloFileHeaders('https://api.trello.com/1/x', CREDENTIAL)).toEqual(AUTH);
    expect(trelloFileHeaders(SIGNED, CREDENTIAL)).toBeUndefined();
    expect(trelloFileHeaders('https://trello.com.evil.test/x', CREDENTIAL)).toBeUndefined();
    expect(trelloFileHeaders('http://trello.com/x', CREDENTIAL)).toBeUndefined();
  });

  it('quotes the key and token in the OAuth header', () => {
    expect(trelloAuthorization(CREDENTIAL)).toBe(AUTH.Authorization);
  });
});
