import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { UrlNotAllowedError } from '@repo/net';

const pinnedFetch = mock(
  async (
    _url: string,
    _init?: { method?: string; headers?: Record<string, string>; body?: string },
  ) => Response.json({}),
);
mock.module('@repo/net', () => ({ pinnedFetch, UrlNotAllowedError }));

const { gitlabListIssues } = await import('../list-issues');
const { gitlabUpdateIssue } = await import('../update-issue');
const { verifyGitlab } = await import('../verify');
const { apiRoot, gitlabRequest, issueRef, projectPath } = await import('../client');

const credential = { token: 'glpat-test' };

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  pinnedFetch.mockImplementation(async () => Response.json(body, { status, headers }));
}

describe('gitlab helpers', () => {
  it('finds the API root of gitlab.com and of an instance under a path', () => {
    expect(apiRoot({})).toBe('https://gitlab.com/api/v4');
    expect(apiRoot({ baseUrl: 'https://git.example.com/gitlab/' })).toBe(
      'https://git.example.com/gitlab/api/v4',
    );
    expect(apiRoot({ baseUrl: 'https://git.example.com/api/v4' })).toBe(
      'https://git.example.com/api/v4',
    );
  });

  it('sends a project path as one encoded segment', () => {
    expect(projectPath('acme/tools/widgets')).toBe('projects/acme%2Ftools%2Fwidgets');
    expect(projectPath(42)).toBe('projects/42');
    expect(() => projectPath(' / ')).toThrow('No GitLab project given');
  });

  it('takes an issue number bare, hashed, or from either issue URL', () => {
    expect(issueRef(12)).toBe(12);
    expect(issueRef('#12')).toBe(12);
    expect(issueRef('https://gitlab.com/acme/widgets/-/issues/12#note_345')).toBe(12);
    expect(issueRef('https://gitlab.com/acme/widgets/-/work_items/7')).toBe(7);
    expect(() => issueRef('https://gitlab.com/acme/widgets/-/merge_requests/7')).toThrow(
      'not a GitLab issue number or URL',
    );
  });
});

describe('gitlab client', () => {
  beforeEach(() => {
    pinnedFetch.mockClear();
  });

  it('sends the token in the PRIVATE-TOKEN header', async () => {
    respond(200, {});
    await gitlabRequest(credential, 'GET', 'projects/42/issues');
    const [url, init] = pinnedFetch.mock.calls[0]!;
    expect(url).toBe('https://gitlab.com/api/v4/projects/42/issues');
    expect(init?.headers).toMatchObject({ 'PRIVATE-TOKEN': 'glpat-test' });
  });

  it('names SSRF_ALLOWED_HOSTS when the address is refused', async () => {
    pinnedFetch.mockImplementation(async () => {
      throw new UrlNotAllowedError('url must not point to a private or local address');
    });
    await expect(
      gitlabRequest({ ...credential, baseUrl: 'https://gitlab.internal' }, 'GET', 'x'),
    ).rejects.toThrow('SSRF_ALLOWED_HOSTS');
  });

  it('lists issues by their number and in the shared state words', async () => {
    respond(200, [{ id: 900, iid: 3, title: 'Bug', state: 'opened', labels: ['bug'] }]);
    const result = (await gitlabListIssues.execute(credential, { project: 'acme/widgets' })) as {
      issues: { number: number; state: string; labels: string[] }[];
    };
    expect(pinnedFetch.mock.calls[0]![0]).toBe(
      'https://gitlab.com/api/v4/projects/acme%2Fwidgets/issues?state=opened&per_page=10&page=1',
    );
    expect(result.issues).toEqual([
      expect.objectContaining({ number: 3, state: 'open', labels: ['bug'] }),
    ]);
  });

  it('closes an issue through state_event and sends the body as its description', async () => {
    respond(200, { iid: 3, state: 'closed' });
    await gitlabUpdateIssue.execute(credential, {
      project: 42,
      issue: '#3',
      body: 'Done',
      state: 'closed',
    });
    const [url, init] = pinnedFetch.mock.calls[0]!;
    expect(url).toBe('https://gitlab.com/api/v4/projects/42/issues/3');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init!.body!)).toEqual({ description: 'Done', state_event: 'close' });
  });

  it('names the scopes an insufficient scope would take', async () => {
    respond(403, {
      error: 'insufficient_scope',
      error_description:
        'The request requires higher privileges than provided by the access token.',
      scope: 'api',
    });
    await expect(gitlabRequest(credential, 'POST', 'x', {})).rejects.toThrow(
      'lacks permission for this action: The request requires higher privileges than provided by the access token.; accepted scopes: api',
    );
  });

  it('carries the field errors of a validation failure', async () => {
    respond(400, { message: { title: ['is too long (maximum is 255 characters)'] } });
    await expect(gitlabRequest(credential, 'POST', 'x', {})).rejects.toThrow(
      'GitLab rejected the request as invalid: title is too long (maximum is 255 characters)',
    );
  });

  it('names a moved project instead of following the redirect', async () => {
    respond(405, { message: 'Non GET methods are not allowed for moved projects' });
    await expect(gitlabRequest(credential, 'PUT', 'x', {})).rejects.toThrow('renamed or moved');
    respond(301, {});
    await expect(gitlabRequest(credential, 'GET', 'x')).rejects.toThrow('renamed or moved');
  });

  it('names a rate limit with its wait', async () => {
    pinnedFetch.mockImplementation(
      async () => new Response('Retry later', { status: 429, headers: { 'retry-after': '30' } }),
    );
    await expect(gitlabRequest(credential, 'GET', 'x')).rejects.toThrow(
      'GitLab rate limit reached. Retry after 30 seconds.',
    );
  });
});

describe('verifyGitlab', () => {
  const signal = new AbortController().signal;

  it('rejects only a token GitLab does not know', async () => {
    respond(401, { message: '401 Unauthorized' });
    expect(await verifyGitlab(credential, signal)).toBe('rejected');
    respond(403, { error: 'insufficient_scope' });
    expect(await verifyGitlab(credential, signal)).toBe('unavailable');
    pinnedFetch.mockImplementation(async () => new Response('<html>', { status: 403 }));
    expect(await verifyGitlab(credential, signal)).toBe('unavailable');
  });
});
