import { describe, expect, it } from 'bun:test';
import { detectProvider } from '../../providers';

describe('repository provider events', () => {
  it('normalizes a GitLab pipeline event', () => {
    const headers = { 'x-gitlab-event': 'Pipeline Hook' };
    const provider = detectProvider(headers)!;
    expect(provider.key(headers)).toBe('gitlab');
    expect(
      provider.parse(
        {
          object_kind: 'pipeline',
          object_attributes: {
            id: 19,
            status: 'failed',
            ref: 'feature/site',
            url: 'https://gitlab.com/acme/site/-/pipelines/19',
          },
          merge_request: { iid: 7, source_branch: 'feature/site' },
          project: {
            path_with_namespace: 'acme/site',
            web_url: 'https://gitlab.com/acme/site',
          },
        },
        headers,
      ),
    ).toEqual({
      kind: 'pipeline',
      repo: 'acme/site',
      pullRequestNumber: 7,
      headSha: null,
      status: 'failed',
      url: 'https://gitlab.com/acme/site/-/pipelines/19',
    });
  });

  it('normalizes a completed GitHub check run', () => {
    const headers = { 'x-github-event': 'check_run' };
    const provider = detectProvider(headers)!;
    expect(
      provider.parse(
        {
          check_run: {
            id: 123,
            name: 'Test suite',
            status: 'completed',
            conclusion: 'failure',
            head_sha: 'abc123',
            details_url: 'https://github.com/acme/site/actions/runs/1',
            pull_requests: [{ number: 42 }],
            app: { id: 7 },
          },
          repository: { full_name: 'acme/site' },
        },
        headers,
      ),
    ).toEqual({
      kind: 'check',
      repo: 'acme/site',
      pullRequestNumbers: [42],
      headSha: 'abc123',
      externalId: '123',
      appId: '7',
      name: 'Test suite',
      status: 'failed',
      url: 'https://github.com/acme/site/actions/runs/1',
    });
  });

  it('keeps a queued GitHub check pending without a linked pull request', () => {
    const headers = { 'x-github-event': 'check_run' };
    const provider = detectProvider(headers)!;
    expect(
      provider.parse(
        {
          check_run: {
            id: 124,
            name: 'Build',
            status: 'queued',
            head_sha: 'def456',
            pull_requests: [],
          },
          repository: { full_name: 'acme/site' },
        },
        headers,
      ),
    ).toMatchObject({ kind: 'check', pullRequestNumbers: [], status: 'pending' });
  });
});
