import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { UrlNotAllowedError } from '@repo/net';

const pinnedFetch = mock(async (_url: string, _init?: { method?: string; body?: string }) =>
  Response.json({}),
);
mock.module('@repo/net', () => ({ pinnedFetch, UrlNotAllowedError }));

const { mergeRequestRef } = await import('../client');
const { gitlabReviewMergeRequest } = await import('../review-merge-request');
const { gitlabAcceptMergeRequest } = await import('../accept-merge-request');
const { gitlabListMergeRequestThreads } = await import('../list-merge-request-threads');

const credential = { token: 'glpat-test' };
const mr = 'https://gitlab.com/api/v4/projects/acme%2Fwidgets/merge_requests/4';
const target = { project: 'acme/widgets', mergeRequest: '!4' };

function route(handler: (url: string, method: string, body: unknown) => Response) {
  pinnedFetch.mockImplementation(async (url, init) =>
    handler(url, init?.method ?? 'GET', init?.body ? JSON.parse(init.body) : undefined),
  );
}

function calls() {
  return pinnedFetch.mock.calls.map(
    ([url, init]) => `${init?.method ?? 'GET'} ${url.replace(mr, '')}`,
  );
}

const refs = { base_sha: 'b1', start_sha: 's1', head_sha: 'h1' };

describe('gitlab merge request tools', () => {
  beforeEach(() => pinnedFetch.mockClear());

  it('takes a merge request number bare, with !, or from its URL', () => {
    expect(mergeRequestRef('!4')).toBe(4);
    expect(mergeRequestRef('https://gitlab.com/acme/widgets/-/merge_requests/4/diffs')).toBe(4);
    expect(() => mergeRequestRef('#4')).toThrow('not a GitLab merge request number or URL');
  });

  it('posts the summary and line comments as drafts and publishes them with the requested changes', async () => {
    const bodies: unknown[] = [];
    route((url, method, body) => {
      if (body) bodies.push(body);
      if (method === 'GET' && url.endsWith('/draft_notes')) return Response.json([]);
      if (method === 'GET') return Response.json({ iid: 4, diff_refs: refs });
      if (url.endsWith('/draft_notes')) return Response.json({ id: 31 }, { status: 201 });
      return new Response(null, { status: 204 });
    });
    await gitlabReviewMergeRequest.execute(credential, {
      ...target,
      event: 'request_changes',
      body: 'Needs work',
      comments: [{ path: 'a.ts', newLine: 4, oldLine: 3, body: 'here' }],
    });
    expect(calls()).toEqual([
      'GET /draft_notes',
      'GET ',
      'POST /draft_notes',
      'POST /draft_notes',
      'POST /draft_notes/bulk_publish',
    ]);
    expect(bodies).toEqual([
      { note: 'Needs work' },
      {
        note: 'here',
        position: {
          position_type: 'text',
          ...refs,
          new_path: 'a.ts',
          old_path: 'a.ts',
          new_line: 4,
          old_line: 3,
        },
      },
      { reviewer_state: 'requested_changes' },
    ]);
  });

  it('refuses to review while the account has drafts of its own', async () => {
    route(() => Response.json([{ id: 1 }]));
    await expect(
      gitlabReviewMergeRequest.execute(credential, { ...target, event: 'comment', body: 'x' }),
    ).rejects.toThrow('unpublished draft comments');
    expect(calls()).toEqual(['GET /draft_notes']);
  });

  it('deletes the drafts it made when a later draft fails', async () => {
    let drafts = 0;
    route((url, method) => {
      if (method === 'GET' && url.endsWith('/draft_notes')) return Response.json([]);
      if (method === 'GET') return Response.json({ diff_refs: refs });
      if (method === 'POST' && url.endsWith('/draft_notes')) {
        drafts += 1;
        return drafts === 1
          ? Response.json({ id: 31 }, { status: 201 })
          : Response.json({ message: { line_code: ["can't be blank"] } }, { status: 400 });
      }
      return new Response(null, { status: 204 });
    });
    await expect(
      gitlabReviewMergeRequest.execute(credential, {
        ...target,
        event: 'comment',
        comments: [
          { path: 'a.ts', newLine: 1, body: 'one' },
          { path: 'a.ts', newLine: 999, body: 'two' },
        ],
      }),
    ).rejects.toThrow("line_code can't be blank");
    expect(calls()).toContain('DELETE /draft_notes/31');
    expect(calls()).not.toContain('POST /draft_notes/bulk_publish');
  });

  it('approves without publishing when there is nothing to post', async () => {
    route(() => Response.json({}, { status: 201 }));
    await gitlabReviewMergeRequest.execute(credential, { ...target, event: 'approve' });
    expect(calls()).toEqual(['POST /approve']);
  });

  it('points to mergeStatus when GitLab cannot merge, and to the path when the project moved', async () => {
    route(() => Response.json({ message: '405 Method Not Allowed' }, { status: 405 }));
    await expect(gitlabAcceptMergeRequest.execute(credential, target)).rejects.toThrow(
      'Read its mergeStatus with gitlab_get_merge_request',
    );
    route(() =>
      Response.json(
        { message: 'Non GET methods are not allowed for moved projects' },
        { status: 405 },
      ),
    );
    await expect(gitlabAcceptMergeRequest.execute(credential, target)).rejects.toThrow(
      'renamed or moved',
    );
  });

  it('lists threads without system notes, and pages by the discussions GitLab sent', async () => {
    route(() =>
      Response.json([
        { id: 'd1', notes: [{ id: 1, system: true, body: 'added 1 commit' }] },
        {
          id: 'd2',
          notes: [
            {
              id: 2,
              body: 'why?',
              resolvable: true,
              resolved: true,
              author: { username: 'ann' },
              position: { new_path: 'a.ts', new_line: 5, old_line: null },
            },
            { id: 3, body: 'fixed', resolvable: true, resolved: true, author: { username: 'bob' } },
          ],
        },
      ]),
    );
    const result = (await gitlabListMergeRequestThreads.execute(credential, {
      ...target,
      limit: 2,
    })) as {
      threads: { id: string; resolved: boolean; path: string | null; newLine: number | null }[];
      nextPage: number | null;
    };
    expect(result.threads).toEqual([
      expect.objectContaining({
        id: 'd2',
        resolvable: true,
        resolved: true,
        path: 'a.ts',
        newLine: 5,
      }),
    ]);
    expect(result.nextPage).toBe(2);
  });
});
