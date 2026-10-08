import { describe, it, expect } from 'bun:test';
import type { PinnedRequestInit } from '@repo/net';
import { AttachmentRejectedError } from '../../attachment-download';
import {
  LINEAR_GRAPHQL_URL,
  LinearReader,
  linearRateLimitBackoffMs,
  linearUploadHeaders,
  nextUploadHop,
} from '../../linear-adapter';
import type { LinearIssueNode, LinearScope } from '../../linear-mapping';
import { SourceRateLimitedError } from '../../reader';

const API_KEY = 'lin_api_test';
const SCOPE: LinearScope = { teamId: 'team-ato', projectFilter: 'project', projectId: 'proj-tool' };
const UPLOAD = 'https://uploads.linear.app/org-1/file-1/blob-1';
const SIGNED = 'https://storage.example.test/bucket/blob-1?signature=abc';

interface SentRequest {
  url: string;
  init: PinnedRequestInit | undefined;
}

interface GraphqlCall {
  query: string;
  variables: Record<string, unknown>;
}

function readerAnswering(responses: Response[], sent: SentRequest[] = [], scope = SCOPE) {
  const queue = [...responses];
  return new LinearReader({ apiKey: API_KEY }, scope, async (url, init) => {
    sent.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    return next;
  });
}

function graphqlCall(request: SentRequest): GraphqlCall {
  return JSON.parse(String(request.init?.body)) as GraphqlCall;
}

function page<T>(nodes: T[], endCursor: string | null, hasNextPage: boolean) {
  return { nodes, pageInfo: { hasNextPage, endCursor } };
}

function issueNode(overrides: Partial<LinearIssueNode> = {}): LinearIssueNode {
  return {
    id: 'issue-505',
    identifier: 'ATO-505',
    number: 505,
    title: 'Ship the importer',
    description: `Screenshot ![image.png](${UPLOAD})`,
    priority: 3,
    dueDate: null,
    createdAt: '2025-01-02T03:04:05.000Z',
    updatedAt: '2025-02-03T04:05:06.000Z',
    state: { id: 'state-todo' },
    assignee: null,
    cycle: null,
    parent: null,
    labels: { nodes: [] },
    attachments: { nodes: [] },
    ...overrides,
  };
}

describe('LinearReader requests', () => {
  it('posts the query with the bare API key to Linear and pages until hasNextPage is false', async () => {
    const sent: SentRequest[] = [];
    const reader = readerAnswering(
      [
        Response.json({
          data: {
            team: {
              connection: page([{ id: 's1', name: 'Todo', type: 'unstarted' }], 'c1', true),
            },
          },
        }),
        Response.json({
          data: {
            team: { connection: page([{ id: 's2', name: 'Triage', type: 'triage' }], 'c2', false) },
          },
        }),
      ],
      sent,
    );

    expect(await reader.listStates()).toEqual([
      { sourceId: 's1', name: 'Todo', category: 'unstarted' },
      { sourceId: 's2', name: 'Triage', category: 'backlog' },
    ]);
    expect(sent.map((r) => r.url)).toEqual([LINEAR_GRAPHQL_URL, LINEAR_GRAPHQL_URL]);
    expect(sent[0]!.init).toMatchObject({
      method: 'POST',
      headers: { Authorization: API_KEY, 'Content-Type': 'application/json' },
      timeoutMs: 15_000,
    });
    expect(sent.map((r) => graphqlCall(r).variables)).toEqual([
      { teamId: 'team-ato', after: null },
      { teamId: 'team-ato', after: 'c1' },
    ]);
    expect(graphqlCall(sent[0]!).query).toContain('includeArchived: true');
  });

  it('lists one project of the team, archived issues included, and returns the next cursor', async () => {
    const sent: SentRequest[] = [];
    const reader = readerAnswering(
      [Response.json({ data: { connection: page([issueNode()], 'cursor-2', true) } })],
      sent,
    );

    const result = await reader.listIssues('cursor-1');

    expect(result.cursor).toBe('cursor-2');
    expect(result.items.map((i) => [i.sourceId, i.sequenceId])).toEqual([['issue-505', 505]]);
    const call = graphqlCall(sent[0]!);
    expect(call.variables).toEqual({
      filter: { team: { id: { eq: 'team-ato' } }, project: { id: { eq: 'proj-tool' } } },
      after: 'cursor-1',
    });
    expect(call.query).toContain('includeArchived: true');
  });

  it("skips issues in Linear's trash, which includeArchived also returns", async () => {
    const sent: SentRequest[] = [];
    const trashed = issueNode({
      id: 'issue-506',
      identifier: 'ATO-506',
      trashed: true,
      labels: { nodes: [], pageInfo: { hasNextPage: true } },
    });
    const reader = readerAnswering(
      [
        Response.json({
          data: { connection: page([issueNode({ trashed: false }), trashed], null, false) },
        }),
      ],
      sent,
    );

    const result = await reader.listIssues(null);

    expect(result.items.map((i) => i.sourceId)).toEqual(['issue-505']);
    expect(graphqlCall(sent[0]!).query).toContain('trashed');
  });

  it("lists the team's issues with no project for a no-project job", async () => {
    const sent: SentRequest[] = [];
    const reader = readerAnswering(
      [Response.json({ data: { connection: page([], null, false) } })],
      sent,
      { teamId: 'team-ato', projectFilter: 'none', projectId: null },
    );

    expect(await reader.listIssues(null)).toEqual({ items: [], cursor: null });
    expect(graphqlCall(sent[0]!).variables).toEqual({
      filter: { team: { id: { eq: 'team-ato' } }, project: { null: true } },
      after: null,
    });
  });

  it('reads the relations an issue owns, never its inverse relations', async () => {
    const sent: SentRequest[] = [];
    const reader = readerAnswering(
      [
        Response.json({
          data: {
            issue: {
              connection: page(
                [
                  { type: 'blocks', relatedIssue: { id: 'issue-506' } },
                  { type: 'similar', relatedIssue: { id: 'issue-507' } },
                ],
                null,
                false,
              ),
            },
          },
        }),
      ],
      sent,
    );

    expect(await reader.listIssueRelations('issue-505')).toEqual([
      { kind: 'blocks', sourceIssueSourceId: 'issue-505', targetIssueSourceId: 'issue-506' },
    ]);
    const { query } = graphqlCall(sent[0]!);
    expect(query).toContain('relations(');
    expect(query).not.toContain('inverseRelations');
  });

  it('reads an issue and its comments once for the issue, its comments and its uploads', async () => {
    const sent: SentRequest[] = [];
    const reader = readerAnswering(
      [
        Response.json({ data: { issue: issueNode() } }),
        Response.json({
          data: {
            issue: {
              connection: page(
                [
                  {
                    id: 'comment-1',
                    body: '[log.txt](https://uploads.linear.app/org-1/file-2/blob-2)',
                    createdAt: '2025-01-05T00:00:00.000Z',
                    parent: null,
                    user: null,
                    botActor: { name: 'GitHub' },
                    externalUser: null,
                  },
                ],
                null,
                false,
              ),
            },
          },
        }),
      ],
      sent,
    );

    const issue = await reader.getIssue('issue-505');
    const comments = await reader.listIssueComments('issue-505');
    const uploads = await reader.listIssueAttachments('issue-505');

    expect(issue.descriptionMarkdown).toEndWith('Imported from Linear: ATO-505');
    expect(comments).toMatchObject([{ authorEmail: null, authorName: 'GitHub' }]);
    expect(uploads.map((u) => [u.filename, u.contentType])).toEqual([
      ['image.png', 'image/png'],
      ['log.txt', 'text/plain'],
    ]);
    expect(sent).toHaveLength(2);
    expect(graphqlCall(sent[1]!).query).toContain('includeArchived: true');
  });
});

describe('LinearReader errors', () => {
  it('throws the source-neutral rate-limit error on RATELIMITED', async () => {
    const reset = Date.now() + 30_000;
    const reader = readerAnswering([
      Response.json(
        { errors: [{ message: 'Rate limit exceeded', extensions: { code: 'RATELIMITED' } }] },
        {
          status: 400,
          headers: {
            'x-ratelimit-requests-remaining': '0',
            'x-ratelimit-requests-reset': String(reset),
          },
        },
      ),
    ]);

    const error = await reader.listStates().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SourceRateLimitedError);
    expect((error as Error).message).toBe('Linear rate limit reached');
    expect((error as SourceRateLimitedError).retryAfterMs).toBeGreaterThan(25_000);
    expect((error as SourceRateLimitedError).retryAfterMs).toBeLessThanOrEqual(30_000);
  });

  it('fails the tick with the GraphQL error message, a rejected key included', async () => {
    const reader = readerAnswering([
      Response.json(
        {
          errors: [
            {
              message: 'Authentication required, not authenticated',
              extensions: { code: 'AUTHENTICATION_ERROR' },
            },
          ],
        },
        { status: 401 },
      ),
    ]);
    await expect(reader.listStates()).rejects.toThrow(
      'Linear request failed: Authentication required, not authenticated',
    );
  });

  it('fails the tick on an HTTP error with no GraphQL body', async () => {
    const reader = readerAnswering([new Response('<html>bad gateway</html>', { status: 502 })]);
    await expect(reader.listStates()).rejects.toThrow('Linear request failed: HTTP 502');
  });
});

describe('linearRateLimitBackoffMs', () => {
  const now = 1_000_000;

  it('is null for a request that was not rate limited', () => {
    expect(
      linearRateLimitBackoffMs({ status: 200, errorCodes: [], headers: new Headers() }, now),
    ).toBeNull();
  });

  it('waits a minute when no used-up budget says when it resets', () => {
    expect(
      linearRateLimitBackoffMs(
        { status: 400, errorCodes: ['RATELIMITED'], headers: new Headers() },
        now,
      ),
    ).toBe(60_000);
    expect(
      linearRateLimitBackoffMs({ status: 429, errorCodes: [], headers: new Headers() }, now),
    ).toBe(60_000);
  });

  it('waits until the latest reset of a used-up budget, at least a second', () => {
    const headers = new Headers({
      'x-ratelimit-requests-remaining': '0',
      'x-ratelimit-requests-reset': String(now + 20_000),
      'x-ratelimit-complexity-remaining': '0',
      'x-ratelimit-complexity-reset': String(now + 45_000),
      'x-ratelimit-endpoint-requests-remaining': '7',
      'x-ratelimit-endpoint-requests-reset': String(now + 900_000),
    });
    expect(
      linearRateLimitBackoffMs({ status: 400, errorCodes: ['RATELIMITED'], headers }, now),
    ).toBe(45_000);
    const past = new Headers({
      'x-ratelimit-requests-remaining': '0',
      'x-ratelimit-requests-reset': String(now - 5000),
    });
    expect(
      linearRateLimitBackoffMs({ status: 400, errorCodes: ['RATELIMITED'], headers: past }, now),
    ).toBe(1000);
  });

  it("waits at most an hour, Linear's own window, whatever the reset header says", () => {
    const headers = new Headers({
      'x-ratelimit-requests-remaining': '0',
      'x-ratelimit-requests-reset': String(now + 30 * 24 * 3_600_000),
    });
    expect(
      linearRateLimitBackoffMs({ status: 400, errorCodes: ['RATELIMITED'], headers }, now),
    ).toBe(3_600_000);
  });
});

describe('resolveAttachmentDownload', () => {
  const sourceId = `issue-505 ${UPLOAD}`;

  it('downloads a file Linear serves itself with the API key, reading only the head', async () => {
    const sent: SentRequest[] = [];
    const reader = readerAnswering([new Response('', { status: 200 })], sent);

    expect(await reader.resolveAttachmentDownload('issue-505', sourceId)).toStrictEqual({
      url: UPLOAD,
      headers: { Authorization: API_KEY },
    });
    expect(sent).toEqual([
      {
        url: UPLOAD,
        init: {
          headers: { Authorization: API_KEY },
          timeoutMs: 15_000,
          maxBytes: 0,
          truncateBody: true,
        },
      },
    ]);
  });

  it('follows a redirect chain itself and never sends the key past uploads.linear.app', async () => {
    const sent: SentRequest[] = [];
    const reader = readerAnswering(
      [
        new Response(null, { status: 307, headers: { location: '/org-1/file-1/blob-1-v2' } }),
        new Response(null, { status: 302, headers: { location: SIGNED } }),
        new Response('', { status: 200 }),
      ],
      sent,
    );

    expect(await reader.resolveAttachmentDownload('issue-505', sourceId)).toStrictEqual({
      url: SIGNED,
    });
    expect(sent.map((r) => [r.url, r.init?.headers])).toEqual([
      [UPLOAD, { Authorization: API_KEY }],
      ['https://uploads.linear.app/org-1/file-1/blob-1-v2', { Authorization: API_KEY }],
      [SIGNED, undefined],
    ]);
  });

  it.each([401, 403, 404, 500])('skips a file the host answers with HTTP %d', async (status) => {
    const reader = readerAnswering([new Response('nope', { status })]);
    const error = await reader
      .resolveAttachmentDownload('issue-505', sourceId)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AttachmentRejectedError);
    expect((error as Error).message).toBe(`Linear file storage answered HTTP ${status}`);
  });

  it('waits out a 429 from the file host instead of skipping the file', async () => {
    const reader = readerAnswering([new Response('', { status: 429 })]);
    await expect(reader.resolveAttachmentDownload('issue-505', sourceId)).rejects.toBeInstanceOf(
      SourceRateLimitedError,
    );
  });

  it('skips a file that redirects to plain http or keeps redirecting', async () => {
    const insecure = readerAnswering([
      new Response(null, { status: 302, headers: { location: 'http://storage.example.test/x' } }),
    ]);
    await expect(insecure.resolveAttachmentDownload('issue-505', sourceId)).rejects.toThrow(
      'Linear file storage redirected to a non-https URL',
    );

    const loop = readerAnswering(
      Array.from(
        { length: 4 },
        () => new Response(null, { status: 302, headers: { location: UPLOAD } }),
      ),
    );
    await expect(loop.resolveAttachmentDownload('issue-505', sourceId)).rejects.toThrow(
      'Linear file storage redirected more than 3 times',
    );
  });
});

describe('upload helpers', () => {
  it('sends the API key only to uploads.linear.app', () => {
    expect(linearUploadHeaders(UPLOAD, API_KEY)).toEqual({ Authorization: API_KEY });
    expect(linearUploadHeaders(SIGNED, API_KEY)).toBeUndefined();
    expect(linearUploadHeaders('https://uploads.linear.app.evil.test/x', API_KEY)).toBeUndefined();
  });

  it('reads a redirect without a location as a refusal', () => {
    expect(() => nextUploadHop(UPLOAD, 302, null)).toThrow(
      'Linear file storage redirected nowhere',
    );
    expect(nextUploadHop(UPLOAD, 204, null)).toEqual({ kind: 'download' });
    expect(nextUploadHop(UPLOAD, 410, null)).toEqual({ kind: 'refused' });
  });
});

describe('LinearReader completeness and scope', () => {
  it.each(['labels', 'attachments'] as const)(
    'fails loudly when an issue has more %s than one page',
    async (name) => {
      const node = issueNode({
        [name]: { nodes: [], pageInfo: { hasNextPage: true } },
      } as Partial<LinearIssueNode>);
      const message = `Linear issue ATO-505 has more than 50 ${name}; stopping to avoid a truncated import`;
      await expect(
        readerAnswering([
          Response.json({ data: { connection: page([node], null, false) } }),
        ]).listIssues(null),
      ).rejects.toThrow(message);
      await expect(
        readerAnswering([Response.json({ data: { issue: node } })]).getIssue('issue-505'),
      ).rejects.toThrow(message);
    },
  );

  it('asks for archived link attachments and the nested page info', async () => {
    const sent: SentRequest[] = [];
    await readerAnswering(
      [Response.json({ data: { connection: page([], null, false) } })],
      sent,
    ).listIssues(null);
    const { query } = graphqlCall(sent[0]!);
    expect(query).toContain('attachments(first: 50, includeArchived: true)');
    expect(query.match(/pageInfo \{ hasNextPage \}/g)).toHaveLength(2);
  });

  it('refuses a project scope without a project id', () => {
    for (const projectId of [null, '']) {
      expect(
        () =>
          new LinearReader(
            { apiKey: API_KEY },
            { ...SCOPE, projectId },
            async () => new Response(),
          ),
      ).toThrow('Linear scope needs a projectId');
    }
  });
});
