import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { UrlNotAllowedError } from '@repo/net';

const pinnedFetch = mock(
  async (_url: string, _init?: { headers?: Record<string, string>; body?: string }) =>
    Response.json({}),
);
mock.module('@repo/net', () => ({ pinnedFetch, UrlNotAllowedError }));

const { githubListIssues } = await import('../list-issues');
const { githubCreateDiscussion } = await import('../create-discussion');
const { githubGetDiscussion } = await import('../get-discussion');
const { githubGraphql, githubRequest } = await import('../client');

const credential = { token: 'github_pat_test' };

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  pinnedFetch.mockImplementation(async () => Response.json(body, { status, headers }));
}

describe('github client', () => {
  beforeEach(() => {
    pinnedFetch.mockClear();
  });

  it('sends the headers GitHub requires', async () => {
    respond(200, {});
    await githubRequest(credential, 'GET', 'repos/acme/widgets/issues');
    const [url, init] = pinnedFetch.mock.calls[0]!;
    expect(url).toBe('https://api.github.com/repos/acme/widgets/issues');
    expect(init?.headers).toMatchObject({
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer github_pat_test',
      'User-Agent': 'itsaplan',
      'X-GitHub-Api-Version': '2022-11-28',
    });
  });

  it('calls an Enterprise Server instance under /api/v3', async () => {
    respond(200, {});
    await githubRequest(
      { ...credential, baseUrl: 'https://github.example.com' },
      'GET',
      'repos/acme/widgets/issues',
    );
    expect(pinnedFetch.mock.calls[0]![0]).toBe(
      'https://github.example.com/api/v3/repos/acme/widgets/issues',
    );
  });

  it('names SSRF_ALLOWED_HOSTS when the address is refused', async () => {
    pinnedFetch.mockImplementation(async () => {
      throw new UrlNotAllowedError('url must not point to a private or local address');
    });
    await expect(
      githubRequest({ ...credential, baseUrl: 'https://ghe.internal' }, 'GET', 'x'),
    ).rejects.toThrow('SSRF_ALLOWED_HOSTS');
  });

  it('drops pull requests from the issue list and reads either label shape', async () => {
    respond(200, [
      { number: 1, title: 'Bug', state: 'open', labels: [{ name: 'bug' }, 'p1'] },
      { number: 2, title: 'Fix', state: 'open', pull_request: { url: 'x' } },
    ]);
    const result = (await githubListIssues.execute(credential, {
      owner: 'acme',
      repo: 'widgets',
    })) as { issues: { number: number; labels: string[] }[] };
    expect(result.issues.map((i) => i.number)).toEqual([1]);
    expect(result.issues[0]!.labels).toEqual(['bug', 'p1']);
  });

  it('names a rate limit apart from a missing permission', async () => {
    respond(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0' });
    await expect(githubRequest(credential, 'GET', 'x')).rejects.toThrow(
      'GitHub rate limit reached',
    );
  });

  it('names a secondary rate limit sent without retry-after', async () => {
    respond(
      403,
      { message: 'You have exceeded a secondary rate limit.' },
      { 'x-ratelimit-remaining': '4999', 'x-ratelimit-reset': '1700000000' },
    );
    await expect(githubRequest(credential, 'POST', 'x', {})).rejects.toThrow(
      'Retry after at least a minute.',
    );
  });

  it('names a 403 without a rate limit as a missing permission', async () => {
    respond(403, { message: 'Resource not accessible' });
    await expect(githubRequest(credential, 'GET', 'x')).rejects.toThrow('lacks permission');
  });

  it('names a renamed repository instead of following the redirect', async () => {
    respond(301, { message: 'Moved Permanently' });
    await expect(githubRequest(credential, 'GET', 'x')).rejects.toThrow('renamed or transferred');
    respond(307, { message: 'Temporary Redirect' });
    await expect(githubRequest(credential, 'PATCH', 'x', {})).rejects.toThrow(
      'renamed or transferred',
    );
  });

  it('names a deleted issue on 410', async () => {
    respond(410, { message: 'This issue was deleted' });
    await expect(githubRequest(credential, 'PATCH', 'x', {})).rejects.toThrow(
      'The issue was deleted, or issues are disabled in this repository: This issue was deleted',
    );
  });

  it('carries the validation causes of a 422', async () => {
    respond(422, {
      message: 'Validation Failed',
      errors: [{ resource: 'Issue', field: 'title', code: 'missing_field' }],
    });
    await expect(githubRequest(credential, 'POST', 'x', {})).rejects.toThrow(
      'Validation Failed; title missing_field',
    );
  });

  it('fails a GraphQL call that answers 200 with errors', async () => {
    respond(200, {
      data: { repository: null },
      errors: [
        {
          type: 'NOT_FOUND',
          message: "Could not resolve to a Repository with the name 'acme/nope'.",
        },
      ],
    });
    await expect(githubGraphql(credential, 'query { x }', {})).rejects.toThrow(
      "GitHub rejected the request: Could not resolve to a Repository with the name 'acme/nope'.",
    );
  });

  it('names a GraphQL rate limit', async () => {
    respond(
      200,
      { errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] },
      { 'x-ratelimit-remaining': '0' },
    );
    await expect(githubGraphql(credential, 'query { x }', {})).rejects.toThrow(
      'GitHub rate limit reached',
    );
  });

  const repository = {
    id: 'R_1',
    hasDiscussionsEnabled: true,
    discussionCategories: {
      nodes: [
        { id: 'C_general', name: 'General', slug: 'general' },
        { id: 'C_qa', name: 'Q&A', slug: 'q-a' },
      ],
    },
  };

  it('starts a discussion in the category named by its slug', async () => {
    pinnedFetch
      .mockImplementationOnce(async () => Response.json({ data: { repository } }))
      .mockImplementationOnce(async () =>
        Response.json({
          data: {
            createDiscussion: {
              discussion: { number: 5, title: 'How?', url: 'u', category: { name: 'Q&A' } },
            },
          },
        }),
      );
    const result = await githubCreateDiscussion.execute(
      { ...credential, baseUrl: 'https://github.example.com' },
      { owner: 'acme', repo: 'widgets', category: 'Q-A', title: 'How?', body: 'Text' },
    );
    expect(result).toEqual({ number: 5, title: 'How?', category: 'Q&A', url: 'u' });
    const [url, init] = pinnedFetch.mock.calls[1]!;
    expect(url).toBe('https://github.example.com/api/graphql');
    expect(JSON.parse(String(init?.body)).variables).toEqual({
      input: { repositoryId: 'R_1', categoryId: 'C_qa', title: 'How?', body: 'Text' },
    });
  });

  it('answers an unknown category with the categories the repository has', async () => {
    respond(200, { data: { repository } });
    await expect(
      githubCreateDiscussion.execute(credential, {
        owner: 'acme',
        repo: 'widgets',
        category: 'Ideas',
        title: 't',
        body: 'b',
      }),
    ).rejects.toThrow('The repository has: General, Q&A.');
    expect(pinnedFetch.mock.calls).toHaveLength(1);
  });

  it('reads a discussion with its comments, replies and the next page', async () => {
    const author = { login: 'octo' };
    respond(200, {
      data: {
        repository: {
          discussion: {
            number: 7,
            title: 'How?',
            body: 'Question',
            url: 'u',
            createdAt: 't0',
            closed: false,
            isAnswered: true,
            author: null,
            category: { name: 'Q&A' },
            comments: {
              totalCount: 30,
              nodes: [
                {
                  id: 'DC_1',
                  url: 'u1',
                  body: 'Answer',
                  createdAt: 't1',
                  isAnswer: true,
                  author,
                  replies: {
                    totalCount: 21,
                    nodes: [{ id: 'DC_2', url: 'u2', body: 'Thanks', createdAt: 't2', author }],
                  },
                },
              ],
              pageInfo: { hasNextPage: true, endCursor: 'c1' },
            },
          },
        },
      },
    });
    const result = await githubGetDiscussion.execute(credential, {
      owner: 'acme',
      repo: 'widgets',
      discussion: 'https://github.com/acme/widgets/discussions/7#discussioncomment-1',
    });
    expect(JSON.parse(String(pinnedFetch.mock.calls[0]![1]?.body)).variables).toMatchObject({
      number: 7,
      first: 20,
      after: null,
    });
    expect(result).toMatchObject({
      number: 7,
      author: null,
      answered: true,
      commentCount: 30,
      nextCursor: 'c1',
      comments: [
        {
          id: 'DC_1',
          author: 'octo',
          isAnswer: true,
          replies: [{ id: 'DC_2', author: 'octo', body: 'Thanks' }],
          moreReplies: 20,
        },
      ],
    });
  });

  it('names a discussion that does not exist', async () => {
    respond(200, { data: { repository: { discussion: null } } });
    await expect(
      githubGetDiscussion.execute(credential, { owner: 'acme', repo: 'widgets', discussion: 99 }),
    ).rejects.toThrow('Discussion #99 not found in acme/widgets.');
  });
});
