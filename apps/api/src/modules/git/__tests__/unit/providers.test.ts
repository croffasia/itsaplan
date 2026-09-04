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

  it('uses the GitLab merge commit SHA after a merge', () => {
    const headers = { 'x-gitlab-event': 'Merge Request Hook' };
    const provider = detectProvider(headers)!;
    expect(
      provider.parse(
        {
          object_kind: 'merge_request',
          object_attributes: {
            iid: 7,
            action: 'merge',
            title: 'Release',
            source_branch: 'release/production',
            target_branch: 'main',
            last_commit: { id: 'source-head' },
            merge_commit_sha: 'merge-head',
          },
          project: { path_with_namespace: 'acme/site', default_branch: 'main' },
        },
        headers,
      ),
    ).toMatchObject({ kind: 'pull_request', action: 'merged', headSha: 'merge-head' });
  });

  it('falls back to the GitLab squash commit SHA after a merge', () => {
    const headers = { 'x-gitlab-event': 'Merge Request Hook' };
    const provider = detectProvider(headers)!;
    expect(
      provider.parse(
        {
          object_kind: 'merge_request',
          object_attributes: {
            iid: 8,
            action: 'merge',
            title: 'Squashed release',
            source_branch: 'release/squashed',
            target_branch: 'main',
            last_commit: { id: 'source-head' },
            merge_commit_sha: null,
            squash_commit_sha: 'squash-head',
          },
          project: { path_with_namespace: 'acme/site', default_branch: 'main' },
        },
        headers,
      ),
    ).toMatchObject({ kind: 'pull_request', action: 'merged', headSha: 'squash-head' });
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

  it('normalizes a GitHub branch creation', () => {
    const headers = { 'x-github-event': 'create' };
    const provider = detectProvider(headers)!;
    expect(
      provider.parse(
        {
          ref: 'feature/MKT-42-summary',
          ref_type: 'branch',
          sha: 'abc123',
          repository: {
            full_name: 'acme/site',
            default_branch: 'main',
            html_url: 'https://github.com/acme/site',
          },
        },
        headers,
      ),
    ).toEqual({
      kind: 'branch',
      action: 'created',
      repo: 'acme/site',
      branch: 'feature/MKT-42-summary',
      url: 'https://github.com/acme/site/tree/feature/MKT-42-summary',
      headSha: 'abc123',
      defaultBranch: 'main',
    });
  });

  it('normalizes a new GitLab branch push', () => {
    const headers = { 'x-gitlab-event': 'Push Hook' };
    const provider = detectProvider(headers)!;
    expect(
      provider.parse(
        {
          object_kind: 'push',
          before: '0'.repeat(40),
          after: 'abc123',
          checkout_sha: 'abc123',
          ref: 'refs/heads/MKT-9-branch',
          project: {
            path_with_namespace: 'acme/site',
            default_branch: 'main',
            web_url: 'https://gitlab.com/acme/site',
          },
        },
        headers,
      ),
    ).toMatchObject({
      kind: 'branch',
      action: 'created',
      branch: 'MKT-9-branch',
      headSha: 'abc123',
    });
  });

  it('normalizes an explicit Bitbucket branch creation', () => {
    const headers = { 'x-event-key': 'repo:branch_created' };
    const provider = detectProvider(headers)!;
    expect(
      provider.parse(
        {
          branch: {
            name: 'feature/MKT-11-summary',
            target: { hash: 'def456' },
            links: { html: { href: 'https://bitbucket.org/acme/site/branch/MKT-11-summary' } },
          },
          repository: { full_name: 'acme/site', mainbranch: { name: 'main' } },
        },
        headers,
      ),
    ).toEqual({
      kind: 'branch',
      action: 'created',
      repo: 'acme/site',
      branch: 'feature/MKT-11-summary',
      url: 'https://bitbucket.org/acme/site/branch/MKT-11-summary',
      headSha: 'def456',
      defaultBranch: 'main',
    });
  });

  it('accepts the Bitbucket push-shaped branch deletion payload', () => {
    const headers = { 'x-event-key': 'repo:branch_deleted' };
    const provider = detectProvider(headers)!;
    expect(
      provider.parse(
        {
          push: {
            changes: [{ old: { type: 'branch', name: 'MKT-12-cleanup' }, new: null }],
          },
          repository: { full_name: 'acme/site', mainbranch: { name: 'main' } },
        },
        headers,
      ),
    ).toMatchObject({
      kind: 'branch',
      action: 'deleted',
      branch: 'MKT-12-cleanup',
      headSha: null,
    });
  });
});
