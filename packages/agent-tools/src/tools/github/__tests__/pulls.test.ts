import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { UrlNotAllowedError } from '@repo/net';

const pinnedFetch = mock(async (_url: string, _init?: { method?: string; body?: string }) =>
  Response.json({}),
);
mock.module('@repo/net', () => ({ pinnedFetch, UrlNotAllowedError }));

const { githubReviewPullRequest } = await import('../review-pull-request');
const { githubMergePullRequest } = await import('../merge-pull-request');
const { githubListReviewThreads } = await import('../list-review-threads');
const { githubResolveReviewThread } = await import('../resolve-review-thread');
const { numberRef } = await import('../client');

const credential = { token: 'github_pat_test' };
const repo = { owner: 'acme', repo: 'widgets' };

function respond(body: unknown) {
  pinnedFetch.mockImplementation(async () => Response.json(body));
}

function sent(call = 0) {
  const [url, init] = pinnedFetch.mock.calls[call]!;
  return { url, method: init?.method, body: init?.body ? JSON.parse(init.body) : undefined };
}

describe('github pull request tools', () => {
  beforeEach(() => pinnedFetch.mockClear());

  it('takes a pull request number from its URL, past a tab of the page', () => {
    expect(numberRef('https://github.com/acme/widgets/pull/12/files', 'pull request')).toBe(12);
    expect(() => numberRef('https://github.com/acme/widgets/issues/12', 'pull request')).toThrow(
      'not a GitHub pull request number or URL',
    );
  });

  it('places a comment on the new side, or on the old side when it has only an old line', async () => {
    respond({ id: 1, state: 'CHANGES_REQUESTED' });
    await githubReviewPullRequest.execute(credential, {
      ...repo,
      pull: 7,
      event: 'request_changes',
      body: 'Please fix',
      comments: [
        { path: 'a.ts', newLine: 4, oldLine: 3, body: 'here' },
        { path: 'b.ts', oldLine: 9, body: 'removed' },
      ],
    });
    expect(sent()).toEqual({
      url: 'https://api.github.com/repos/acme/widgets/pulls/7/reviews',
      method: 'POST',
      body: {
        event: 'REQUEST_CHANGES',
        body: 'Please fix',
        comments: [
          { path: 'a.ts', body: 'here', line: 4, side: 'RIGHT' },
          { path: 'b.ts', body: 'removed', line: 9, side: 'LEFT' },
        ],
      },
    });
  });

  it('refuses a comment review without a body or a comment without a line, before calling', async () => {
    await expect(
      githubReviewPullRequest.execute(credential, { ...repo, pull: 7, event: 'comment' }),
    ).rejects.toThrow('Give a body');
    await expect(
      githubReviewPullRequest.execute(credential, {
        ...repo,
        pull: 7,
        event: 'approve',
        comments: [{ path: 'a.ts', body: 'x' }],
      }),
    ).rejects.toThrow('Give newLine or oldLine');
    expect(pinnedFetch.mock.calls).toHaveLength(0);
  });

  it('merges with the method and the head commit it was given', async () => {
    respond({ merged: true, sha: 'm1', message: 'Pull Request successfully merged' });
    const result = await githubMergePullRequest.execute(credential, {
      ...repo,
      pull: '#7',
      method: 'squash',
      sha: 'h1',
    });
    expect(sent()).toMatchObject({
      url: 'https://api.github.com/repos/acme/widgets/pulls/7/merge',
      method: 'PUT',
      body: { merge_method: 'squash', sha: 'h1' },
    });
    expect(result).toEqual({
      merged: true,
      sha: 'm1',
      message: 'Pull Request successfully merged',
    });
  });

  it('lists review threads with their side and the next page', async () => {
    respond({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [
                {
                  id: 'PRRT_1',
                  isResolved: false,
                  isOutdated: true,
                  path: 'a.ts',
                  line: null,
                  originalLine: 5,
                  diffSide: 'LEFT',
                  comments: {
                    totalCount: 1,
                    nodes: [{ author: { login: 'octo' }, body: 'why?', createdAt: 't', url: 'u' }],
                  },
                },
              ],
              pageInfo: { hasNextPage: true, endCursor: 'c1' },
            },
          },
        },
      },
    });
    const result = await githubListReviewThreads.execute(credential, { ...repo, pull: 7 });
    expect(result).toEqual({
      threads: [
        {
          id: 'PRRT_1',
          resolved: false,
          outdated: true,
          path: 'a.ts',
          line: 5,
          side: 'old',
          comments: [{ author: 'octo', body: 'why?', createdAt: 't', url: 'u' }],
        },
      ],
      nextCursor: 'c1',
    });
  });

  it('reopens a thread through unresolveReviewThread', async () => {
    respond({ data: { unresolveReviewThread: { thread: { id: 'PRRT_1', isResolved: false } } } });
    const result = await githubResolveReviewThread.execute(credential, {
      thread: 'PRRT_1',
      resolved: false,
    });
    expect(sent().body.query).toContain('unresolveReviewThread(input: $input)');
    expect(sent().body.variables).toEqual({ input: { threadId: 'PRRT_1' } });
    expect(result).toEqual({ id: 'PRRT_1', resolved: false });
  });
});
