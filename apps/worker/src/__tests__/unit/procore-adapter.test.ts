import { describe, it, expect } from 'bun:test';
import type { PinnedRequestInit } from '@repo/net';
import { ProcoreReader, isProcoreHost, procoreRetryAfterMs } from '../../procore-adapter';
import {
  mapProcoreAttachments,
  mapProcorePunchItem,
  mapProcoreRfi,
  mapProcoreRfiReplies,
  procoreNextPage,
  procoreStates,
  type ProcorePunchItem,
  type ProcoreRfi,
} from '../../procore-mapping';
import { SourceRateLimitedError } from '../../reader';
import punchFixture from './fixtures/procore-punch-item.json';
import rfiFixture from './fixtures/procore-rfi.json';

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
const token = (expires = 5400) => json({ access_token: 'tok', expires_in: expires });
const CREDENTIAL = { clientId: 'cid', clientSecret: 'sec', companyId: '55' };
const punch = punchFixture as ProcorePunchItem;
const rfi = rfiFixture as ProcoreRfi;

describe('procore mapping', () => {
  it('maps a punch item', () => {
    expect(mapProcorePunchItem(punch)).toEqual({
      sourceId: '4021',
      sequenceId: 12,
      title: 'Repaint lobby wall',
      descriptionMarkdown:
        'Paint is chipped near the elevator & door.\n\nImported from Procore: punch item (id 4021)',
      stateSourceId: 'ready-for-review',
      assigneeEmail: 'sam@example.com',
      labelSourceIds: [],
      cycleSourceId: null,
      parentSourceId: null,
      priority: 'high',
      startDate: null,
      dueDate: '2025-03-14',
      customFields: [],
      createdAt: '2025-02-01T09:30:00Z',
      updatedAt: '2025-02-10T16:00:00Z',
    });
  });

  it('maps an RFI with its question as the description and answers as comments', () => {
    const issue = mapProcoreRfi(rfi);
    expect(issue.title).toBe('Beam size at gridline C');
    expect(issue.sequenceId).toBe(7);
    expect(issue.stateSourceId).toBe('open');
    expect(issue.assigneeEmail).toBe('lee@example.com');
    expect(issue.dueDate).toBe('2025-04-01');
    expect(issue.descriptionMarkdown).toContain('Is the beam W12x26 or W14x30?');
    const comments = mapProcoreRfiReplies(rfi);
    expect(comments.map((c) => c.sourceId)).toEqual(['501', '502']);
    expect(comments[1]).toMatchObject({
      authorEmail: 'lee@example.com',
      authorName: 'Eng Lee',
      bodyMarkdown: 'Later answer',
    });
    expect(comments[0]!.authorEmail).toBeNull();
  });

  it('maps attachments that have a URL', () => {
    expect(mapProcoreAttachments(punch.attachments)).toEqual([
      { sourceId: '77', filename: 'wall.jpg', contentType: 'image/jpeg', sizeBytes: 2048 },
    ]);
    expect(mapProcoreAttachments([{ id: 1 }])).toEqual([]);
  });

  it('gives each tool its states', () => {
    expect(procoreStates('rfis').map((s) => s.sourceId)).toEqual([
      'draft',
      'open',
      'closed',
      'void',
    ]);
    expect(procoreStates('punch_items').find((s) => s.sourceId === 'closed')?.category).toBe(
      'completed',
    );
  });

  it('computes the next page from the Total header, or a full page', () => {
    const h = (total: string, perPage: string) => new Headers({ total, 'per-page': perPage });
    expect(procoreNextPage(h('250', '100'), 1, 100, 100)).toBe(2);
    expect(procoreNextPage(h('250', '100'), 3, 100, 50)).toBeNull();
    expect(procoreNextPage(new Headers(), 1, 100, 100)).toBe(2);
    expect(procoreNextPage(new Headers(), 1, 100, 40)).toBeNull();
  });
});

describe('ProcoreReader', () => {
  it('gets a client-credentials token, then lists punch items with the company header', async () => {
    const sent: Sent[] = [];
    const reader = new ProcoreReader(
      CREDENTIAL,
      '9',
      'punch_items',
      fetchAnswering(
        [token(), json([punchFixture], { headers: { total: '150', 'per-page': '100' } })],
        sent,
      ),
    );
    const page = await reader.listIssues(null);
    expect(page.cursor).toBe('2');
    expect(page.items[0]!.title).toBe('Repaint lobby wall');
    expect(sent[0]!.url).toBe('https://login.procore.com/oauth/token');
    expect(sent[0]!.init?.method).toBe('POST');
    const form = new URLSearchParams(sent[0]!.init?.body as string);
    expect(Object.fromEntries(form)).toEqual({
      grant_type: 'client_credentials',
      client_id: 'cid',
      client_secret: 'sec',
    });
    const list = new URL(sent[1]!.url);
    expect(list.origin).toBe('https://api.procore.com');
    expect(list.pathname).toBe('/rest/v1.0/punch_items');
    expect(list.searchParams.get('project_id')).toBe('9');
    expect(list.searchParams.get('page')).toBe('1');
    expect(sent[1]!.init?.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'Procore-Company-Id': '55',
    });
  });

  it('uses the sandbox hosts when asked', async () => {
    const sent: Sent[] = [];
    const reader = new ProcoreReader(
      { ...CREDENTIAL, sandbox: true },
      '9',
      'rfis',
      fetchAnswering([token(), json([])], sent),
    );
    await reader.listIssues('3');
    expect(sent[0]!.url).toBe('https://login-sandbox.procore.com/oauth/token');
    const list = new URL(sent[1]!.url);
    expect(list.origin).toBe('https://sandbox.procore.com');
    expect(list.pathname).toBe('/rest/v1.0/projects/9/rfis');
    expect(list.searchParams.get('page')).toBe('3');
  });

  it('caches the token until it expires, and requests a new one after', async () => {
    const sent: Sent[] = [];
    let now = 0;
    const reader = new ProcoreReader(
      CREDENTIAL,
      '9',
      'rfis',
      fetchAnswering([token(), json([]), json([]), token(), json([])], sent),
      () => now,
    );
    await reader.listIssues(null);
    now = 1000;
    await reader.listIssues(null);
    now = 5400_000;
    await reader.listIssues(null);
    expect(sent.filter((s) => s.url.endsWith('/oauth/token'))).toHaveLength(2);
  });

  it('refreshes the token once after a 401', async () => {
    const sent: Sent[] = [];
    const reader = new ProcoreReader(
      CREDENTIAL,
      '9',
      'rfis',
      fetchAnswering([token(), json({}, { status: 401 }), token(), json([])], sent),
    );
    expect((await reader.listIssues(null)).items).toEqual([]);
    expect(sent).toHaveLength(4);
  });

  it('turns a 429 into a rate limit with Retry-After', async () => {
    const reader = new ProcoreReader(
      CREDENTIAL,
      '9',
      'rfis',
      fetchAnswering([token(), json({}, { status: 429, headers: { 'retry-after': '12' } })], []),
    );
    const err = await reader.listIssues(null).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceRateLimitedError);
    expect((err as SourceRateLimitedError).retryAfterMs).toBe(12_000);
  });

  it('reads the wait from X-Rate-Limit-Reset without Retry-After', () => {
    expect(procoreRetryAfterMs(new Headers({ 'x-rate-limit-reset': '30' }))).toBe(30_000);
    expect(
      procoreRetryAfterMs(new Headers({ 'x-rate-limit-reset': '1700000045' }), 1_700_000_000_000),
    ).toBe(45_000);
    expect(procoreRetryAfterMs(new Headers())).toBe(60_000);
  });

  it('fails on a token error and on a rejected request', async () => {
    const rejected = new ProcoreReader(
      CREDENTIAL,
      '9',
      'rfis',
      fetchAnswering([json({}, { status: 401 })], []),
    );
    expect(rejected.listIssues(null)).rejects.toThrow('token request failed: HTTP 401');
    const failing = new ProcoreReader(
      CREDENTIAL,
      '9',
      'rfis',
      fetchAnswering([token(), json({}, { status: 500 })], []),
    );
    expect(failing.listIssues(null)).rejects.toThrow('HTTP 500');
  });

  it('reads RFI replies from the RFI detail, fetched once', async () => {
    const sent: Sent[] = [];
    const reader = new ProcoreReader(
      CREDENTIAL,
      '9',
      'rfis',
      fetchAnswering([token(), json(rfiFixture)], sent),
    );
    expect((await reader.listIssueComments('9001')).map((c) => c.sourceId)).toEqual(['501', '502']);
    expect((await reader.getIssue('9001')).title).toBe('Beam size at gridline C');
    expect(sent).toHaveLength(2);
    expect(new URL(sent[1]!.url).pathname).toBe('/rest/v1.0/projects/9/rfis/9001');
  });

  it('sends the bearer token to Procore hosts only when resolving an attachment', async () => {
    const sent: Sent[] = [];
    const reader = new ProcoreReader(
      CREDENTIAL,
      '9',
      'punch_items',
      fetchAnswering(
        [
          token(),
          json(punchFixture),
          new Response(null, {
            status: 302,
            headers: { location: 'https://procore-files.s3.amazonaws.com/x?sig=1' },
          }),
          new Response(null, { status: 200 }),
        ],
        sent,
      ),
    );
    const download = await reader.resolveAttachmentDownload('4021', '77');
    expect(download.url).toBe('https://procore-files.s3.amazonaws.com/x?sig=1');
    expect(download.headers).toBeUndefined();
    expect(sent[2]!.url).toBe('https://api.procore.com/rest/v1.0/files/77/download');
    expect(sent[2]!.init?.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'Procore-Company-Id': '55',
    });
    expect(sent[3]!.init?.headers).toBeUndefined();
  });

  it('recognises Procore hosts', () => {
    expect(isProcoreHost('api.procore.com')).toBe(true);
    expect(isProcoreHost('login-sandbox.procore.com')).toBe(true);
    expect(isProcoreHost('procore.com.evil.example')).toBe(false);
    expect(isProcoreHost('evilprocore.com')).toBe(false);
  });
});
