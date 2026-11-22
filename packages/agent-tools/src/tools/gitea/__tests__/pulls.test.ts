import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { ResponseTooLargeError, UrlNotAllowedError } from '@repo/net';

const pinnedFetch = mock(
  async (_url: string, _init?: { method?: string; body?: string; maxBytes?: number }) =>
    Response.json({}),
);
mock.module('@repo/net', () => ({ pinnedFetch, ResponseTooLargeError, UrlNotAllowedError }));

const { splitDiff } = await import('../diff');
const { numberRef } = await import('../client');
const { giteaListPullRequestFiles } = await import('../list-pull-request-files');
const { giteaReviewPullRequest } = await import('../review-pull-request');
const { giteaMergePullRequest } = await import('../merge-pull-request');
const { giteaReplyReviewComment } = await import('../reply-review-comment');
const { giteaResolveReviewComment } = await import('../resolve-review-comment');
const { giteaListReviewComments } = await import('../list-review-comments');

const credential = { baseUrl: 'https://git.example.com', token: 't' };
const repo = { owner: 'acme', repo: 'widgets' };
const api = 'https://git.example.com/api/v1/repos/acme/widgets';

const DIFF = [
  'diff --git a/src/app.ts b/src/app.ts',
  'index 1111111..2222222 100644',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1,2 +1,2 @@',
  ' keep',
  '-old',
  '+new',
  'diff --git a/empty.txt b/empty.txt',
  'new file mode 100644',
  'index 0000000..e69de29',
  'diff --git a/gone.md b/gone.md',
  'deleted file mode 100644',
  '--- a/gone.md',
  '+++ /dev/null',
  '@@ -1 +0,0 @@',
  '-bye',
  'diff --git a/old name.ts b/new name.ts',
  'similarity index 90%',
  'rename from old name.ts',
  'rename to new name.ts',
  '--- a/old name.ts',
  '+++ b/new name.ts',
  '@@ -3 +3 @@',
  '-a',
  '+b',
  'diff --git a/logo.png b/logo.png',
  'index 3333333..4444444 100644',
  'Binary files a/logo.png and b/logo.png differ',
  'diff --git "a/say \\"hi\\".txt" "b/say \\"hi\\".txt"',
  'new file mode 100644',
  '--- /dev/null',
  '+++ "b/say \\"hi\\".txt"',
  '@@ -0,0 +1 @@',
  '+hi',
  '',
].join('\n');

function route(handler: (url: string, method: string) => Response) {
  pinnedFetch.mockImplementation(async (url, init) => handler(url, init?.method ?? 'GET'));
}

describe('gitea diff', () => {
  it('splits a diff into files, naming each path and status', () => {
    expect(
      splitDiff(DIFF).map(({ path, previousPath, status, additions, deletions, patch }) => ({
        path,
        previousPath,
        status,
        additions,
        deletions,
        hasPatch: patch !== null,
      })),
    ).toEqual([
      {
        path: 'src/app.ts',
        previousPath: null,
        status: 'modified',
        additions: 1,
        deletions: 1,
        hasPatch: true,
      },
      {
        path: 'empty.txt',
        previousPath: null,
        status: 'added',
        additions: 0,
        deletions: 0,
        hasPatch: false,
      },
      {
        path: 'gone.md',
        previousPath: null,
        status: 'deleted',
        additions: 0,
        deletions: 1,
        hasPatch: true,
      },
      {
        path: 'new name.ts',
        previousPath: 'old name.ts',
        status: 'renamed',
        additions: 1,
        deletions: 1,
        hasPatch: true,
      },
      {
        path: 'logo.png',
        previousPath: null,
        status: 'modified',
        additions: 0,
        deletions: 0,
        hasPatch: false,
      },
      {
        path: 'say "hi".txt',
        previousPath: null,
        status: 'added',
        additions: 1,
        deletions: 0,
        hasPatch: true,
      },
    ]);
    expect(splitDiff(DIFF)[0]!.patch).toBe('@@ -1,2 +1,2 @@\n keep\n-old\n+new');
  });
});

describe('gitea pull request tools', () => {
  beforeEach(() => pinnedFetch.mockClear());

  it('takes the pull request number from a URL that carries a comment anchor', () => {
    expect(numberRef('https://git.example.com/acme/widgets/pulls/12#issuecomment-345')).toBe(12);
  });

  it('pages the files of the diff', async () => {
    route(() => new Response(DIFF));
    const result = (await giteaListPullRequestFiles.execute(credential, {
      ...repo,
      pull: 3,
      limit: 2,
      page: 2,
    })) as { files: { path: string }[]; totalFiles: number };
    expect(pinnedFetch.mock.calls[0]![0]).toBe(`${api}/pulls/3.diff`);
    expect(result.files.map((f) => f.path)).toEqual(['gone.md', 'new name.ts']);
    expect(result.totalFiles).toBe(6);
  });

  it('refuses a diff over the size cap', async () => {
    pinnedFetch.mockImplementation(async () => {
      throw new ResponseTooLargeError('response exceeds the byte limit');
    });
    await expect(
      giteaListPullRequestFiles.execute(credential, { ...repo, pull: 3 }),
    ).rejects.toThrow('The diff is larger than 10 MB');
    expect(pinnedFetch.mock.calls[0]![1]!.maxBytes).toBe(10 * 1024 * 1024);
  });

  it('sends a comment with a new line on the new side only', async () => {
    route(() => Response.json({ id: 1, state: 'APPROVED' }));
    await giteaReviewPullRequest.execute(credential, {
      ...repo,
      pull: 3,
      event: 'approve',
      comments: [
        { path: 'a.ts', newLine: 4, oldLine: 3, body: 'here' },
        { path: 'b.ts', oldLine: 9, body: 'removed' },
      ],
    });
    expect(JSON.parse(pinnedFetch.mock.calls[0]![1]!.body!)).toEqual({
      event: 'APPROVED',
      comments: [
        { path: 'a.ts', body: 'here', new_position: 4 },
        { path: 'b.ts', body: 'removed', old_position: 9 },
      ],
    });
  });

  it('merges with the field names every Gitea and Forgejo version reads', async () => {
    route(() => new Response(null, { status: 200 }));
    await giteaMergePullRequest.execute(credential, {
      ...repo,
      pull: 3,
      method: 'squash',
      title: 'T',
      sha: 'h1',
      deleteBranch: true,
    });
    expect(JSON.parse(pinnedFetch.mock.calls[0]![1]!.body!)).toEqual({
      Do: 'squash',
      MergeTitleField: 'T',
      head_commit_id: 'h1',
      delete_branch_after_merge: true,
    });
  });

  it('carries the reason Gitea gives for refusing a merge', async () => {
    route(() =>
      Response.json({ message: 'Work in progress PRs cannot be merged' }, { status: 405 }),
    );
    await expect(giteaMergePullRequest.execute(credential, { ...repo, pull: 3 })).rejects.toThrow(
      'Gitea does not allow this action now: Work in progress PRs cannot be merged',
    );
  });

  it('names the version a reply or a resolve needs when the server answers 404', async () => {
    route(() => Response.json({ message: 'not found' }, { status: 404 }));
    await expect(
      giteaReplyReviewComment.execute(credential, { ...repo, pull: 3, comment: 5, body: 'ok' }),
    ).rejects.toThrow('cannot reply to review comments over its API: that needs Gitea 28 or newer');
    await expect(
      giteaResolveReviewComment.execute(credential, { ...repo, comment: 5, resolved: false }),
    ).rejects.toThrow('cannot resolve review comments over its API: that needs Gitea 28 or newer');
    expect(pinnedFetch.mock.calls[1]![0]).toBe(`${api}/pulls/comments/5/unresolve`);
  });

  it('reads the comments of every review that has some', async () => {
    route((url) => {
      if (url.endsWith('/reviews?limit=50&page=1')) {
        return Response.json([
          { id: 1, comments_count: 0 },
          { id: 2, comments_count: 1 },
        ]);
      }
      if (url.endsWith('/reviews?limit=50&page=2')) return Response.json([]);
      if (url.endsWith('/reviews/2/comments')) {
        return Response.json([
          {
            id: 9,
            pull_request_review_id: 2,
            path: 'a.ts',
            position: 0,
            original_position: 7,
            body: 'why?',
            user: { login: 'ann' },
            resolver: { login: 'bob' },
          },
        ]);
      }
      return Response.json({ message: `unexpected ${url}` }, { status: 500 });
    });
    const result = await giteaListReviewComments.execute(credential, { ...repo, pull: 3 });
    expect(result).toEqual({
      comments: [
        {
          id: 9,
          reviewId: 2,
          path: 'a.ts',
          newLine: null,
          oldLine: 7,
          author: 'ann',
          body: 'why?',
          resolved: true,
          createdAt: null,
          url: null,
        },
      ],
    });
    expect(pinnedFetch.mock.calls).toHaveLength(3);
  });
});
