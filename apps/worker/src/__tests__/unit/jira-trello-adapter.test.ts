import { describe, it, expect } from 'bun:test';
import type { PinnedRequestInit } from '@repo/net';
import { JiraReader, isJiraCloudUrl, jiraNextCursor } from '../../jira-adapter';
import { TrelloReader, trelloDownloadUrl } from '../../trello-adapter';
import { SourceRateLimitedError } from '../../reader';
import { AttachmentRejectedError } from '../../attachment-download';
import issueFixture from './fixtures/jira-issue.json';

interface Sent {
  url: string;
  init: PinnedRequestInit | undefined;
}

function fetchAnswering(responses: Response[], sent: Sent[]) {
  const queue = [...responses];
  return async (url: string, init?: PinnedRequestInit) => {
    sent.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    return next;
  };
}

const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);
const JIRA = { baseUrl: 'https://acme.atlassian.net', email: 'a@x.com', apiToken: 'tok' };
const FIELDS = [
  { id: 'customfield_10020', schema: { custom: 'com.pyxis.greenhopper.jira:gh-sprint' } },
];

describe('JiraReader', () => {
  it('refuses a base URL that is not a Jira Cloud origin', () => {
    expect(isJiraCloudUrl('https://acme.atlassian.net')).toBe(true);
    expect(isJiraCloudUrl('https://acme.atlassian.net/jira')).toBe(false);
    expect(isJiraCloudUrl('https://evil.example.com')).toBe(false);
    expect(
      () => new JiraReader({ ...JIRA, baseUrl: 'http://acme.atlassian.net' }, 'OPS'),
    ).toThrow();
  });

  it('pages issues with nextPageToken and sends Basic auth', async () => {
    const sent: Sent[] = [];
    const reader = new JiraReader(
      JIRA,
      'OPS',
      fetchAnswering([json(FIELDS), json({ issues: [issueFixture], nextPageToken: 'n1' })], sent),
    );
    const page = await reader.listIssues(null);
    expect(page.cursor).toBe('n1');
    expect(page.items[0]!.cycleSourceId).toBe('4');
    const search = new URL(sent[1]!.url);
    expect(search.pathname).toBe('/rest/api/3/search/jql');
    expect(search.searchParams.get('jql')).toBe('project = "OPS" ORDER BY created ASC');
    expect(search.searchParams.get('fields')).toContain('customfield_10020');
    expect((sent[1]!.init?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${btoa('a@x.com:tok')}`,
    );
  });

  it('stops paging on isLast or a missing token', () => {
    expect(jiraNextCursor({ issues: [], nextPageToken: 'x', isLast: true })).toBeNull();
    expect(jiraNextCursor({ issues: [] })).toBeNull();
  });

  it('turns a 429 into a rate limit with Retry-After', async () => {
    const reader = new JiraReader(
      JIRA,
      'OPS',
      fetchAnswering([json({}, { status: 429, headers: { 'retry-after': '30' } })], []),
    );
    const err = await reader.listStates().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceRateLimitedError);
    expect((err as SourceRateLimitedError).retryAfterMs).toBe(30_000);
  });

  it('sends the credential to the site only, not to the media redirect', async () => {
    const sent: Sent[] = [];
    const reader = new JiraReader(
      JIRA,
      'OPS',
      fetchAnswering(
        [
          new Response(null, {
            status: 303,
            headers: { location: 'https://api.media.atlassian.com/file/1?token=t' },
          }),
          new Response(null, { status: 200 }),
        ],
        sent,
      ),
    );
    const download = await reader.resolveAttachmentDownload('10042', '20001');
    expect(sent[0]!.url).toBe('https://acme.atlassian.net/rest/api/3/attachment/content/20001');
    expect(sent[0]!.init?.headers).toBeDefined();
    expect(sent[1]!.init?.headers).toBeUndefined();
    expect(download).toEqual({ url: 'https://api.media.atlassian.com/file/1?token=t' });
  });

  it('pages comments by startAt until total', async () => {
    const comment = (id: string) => ({ id, body: null, created: '2024-01-01T00:00:00.000+0000' });
    const reader = new JiraReader(
      JIRA,
      'OPS',
      fetchAnswering(
        [
          json({ comments: [comment('1')], total: 2 }),
          json({ comments: [comment('2')], total: 2 }),
        ],
        [],
      ),
    );
    expect((await reader.listIssueComments('10042')).map((c) => c.sourceId)).toEqual(['1', '2']);
  });
});

describe('TrelloReader', () => {
  const CRED = { apiKey: 'key', token: 'tok' };

  it('sends the OAuth header and no key in the URL', async () => {
    const sent: Sent[] = [];
    const reader = new TrelloReader(CRED, 'board-1', fetchAnswering([json([])], sent));
    await reader.listStates();
    expect(sent[0]!.url).toBe(
      'https://api.trello.com/1/boards/board-1/lists?filter=all&fields=name,closed',
    );
    expect((sent[0]!.init?.headers as Record<string, string>).Authorization).toBe(
      'OAuth oauth_consumer_key="key", oauth_token="tok"',
    );
  });

  it('downloads from api.trello.com with the header, and refuses an error', async () => {
    expect(trelloDownloadUrl('https://trello.com/1/cards/c/attachments/a/download/f.pdf')).toBe(
      'https://api.trello.com/1/cards/c/attachments/a/download/f.pdf',
    );
    const sent: Sent[] = [];
    const reader = new TrelloReader(
      CRED,
      'board-1',
      fetchAnswering(
        [
          json({ url: 'https://trello.com/1/cards/c/attachments/a/download/f.pdf' }),
          new Response(null, { status: 404 }),
        ],
        sent,
      ),
    );
    const err = await reader.resolveAttachmentDownload('c', 'a').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AttachmentRejectedError);
    expect(sent[1]!.url).toBe('https://api.trello.com/1/cards/c/attachments/a/download/f.pdf');
  });
});
