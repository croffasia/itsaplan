import { describe, expect, it } from 'bun:test';
import {
  bitbucketRepository,
  giteaRepository,
  githubPullRequest,
  githubRepository,
  gitlabPullRequest,
  gitlabRepository,
  providerErrorMessage,
} from '../../connections-provider';

describe('Git provider repository responses', () => {
  it('accepts a GitHub repository only when webhooks can be managed', () => {
    expect(
      githubRepository({
        id: 42,
        full_name: 'acme/app',
        html_url: 'https://github.com/acme/app',
        private: true,
        permissions: { admin: true },
      }),
    ).toEqual({
      externalId: '42',
      fullName: 'acme/app',
      webUrl: 'https://github.com/acme/app',
      private: true,
    });
    expect(
      githubRepository({
        id: 42,
        full_name: 'acme/app',
        html_url: 'https://github.com/acme/app',
        permissions: { admin: false },
      }),
    ).toBeNull();
  });

  it('normalizes a GitLab project', () => {
    expect(
      gitlabRepository({
        id: 81,
        path_with_namespace: 'acme/api',
        web_url: 'https://gitlab.com/acme/api',
        visibility: 'private',
      }),
    ).toEqual({
      externalId: '81',
      fullName: 'acme/api',
      webUrl: 'https://gitlab.com/acme/api',
      private: true,
    });
    expect(
      gitlabRepository({
        id: 82,
        path_with_namespace: 'acme/internal',
        web_url: 'https://gitlab.com/acme/internal',
        visibility: 'internal',
      }),
    ).toMatchObject({ private: true });
  });

  it('normalizes Gitea and Forgejo repositories with admin access', () => {
    expect(
      giteaRepository({
        id: 12,
        full_name: 'acme/infra',
        html_url: 'https://git.example.com/acme/infra',
        private: false,
        permissions: { admin: true },
      }),
    ).toEqual({
      externalId: '12',
      fullName: 'acme/infra',
      webUrl: 'https://git.example.com/acme/infra',
      private: false,
    });
  });

  it('normalizes a Bitbucket Cloud repository', () => {
    expect(
      bitbucketRepository({
        uuid: '{repo-uuid}',
        full_name: 'acme/mobile',
        links: { html: { href: 'https://bitbucket.org/acme/mobile' } },
        is_private: true,
      }),
    ).toEqual({
      externalId: 'acme/mobile',
      fullName: 'acme/mobile',
      webUrl: 'https://bitbucket.org/acme/mobile',
      private: true,
    });
    expect(bitbucketRepository({ full_name: 'acme/fallback' })).toMatchObject({
      webUrl: 'https://bitbucket.org/acme/fallback',
      private: true,
    });
  });

  it('rejects malformed provider responses', () => {
    expect(githubRepository({ id: 1, permissions: { admin: true } })).toBeNull();
    expect(gitlabRepository({ id: 1, path_with_namespace: 'acme/api' })).toBeNull();
    expect(bitbucketRepository({})).toBeNull();
    expect(
      gitlabRepository({
        id: 1,
        path_with_namespace: 'acme/api',
        web_url: 'javascript:alert(1)',
      }),
    ).toBeNull();
  });

  it('normalizes GitHub pull requests for manual linking', () => {
    expect(
      githubPullRequest({
        number: 42,
        title: 'Ship the feature',
        html_url: 'https://github.com/acme/app/pull/42',
        state: 'closed',
        merged_at: '2026-08-30T12:00:00Z',
        draft: false,
        head: { ref: 'feature/ship', sha: 'abc123' },
        base: { ref: 'main' },
        updated_at: '2026-08-30T12:00:00Z',
      }),
    ).toMatchObject({
      number: 42,
      state: 'merged',
      sourceBranch: 'feature/ship',
      targetBranch: 'main',
      headSha: 'abc123',
    });
  });

  it('normalizes GitLab merge requests for manual linking', () => {
    expect(
      gitlabPullRequest({
        iid: 17,
        title: 'Draft: Ship the feature',
        web_url: 'https://gitlab.com/acme/app/-/merge_requests/17',
        state: 'opened',
        draft: true,
        source_branch: 'feature/ship',
        target_branch: 'develop',
        sha: 'def456',
        updated_at: '2026-08-30T12:00:00Z',
      }),
    ).toMatchObject({
      number: 17,
      state: 'open',
      draft: true,
      sourceBranch: 'feature/ship',
      targetBranch: 'develop',
      headSha: 'def456',
    });
  });
});

describe('Git provider errors', () => {
  it('explains GitHub permission and SSO failures', () => {
    expect(
      providerErrorMessage('github', 403, 'Resource not accessible by personal access token'),
    ).toContain('missing permission');
    expect(providerErrorMessage('github', 403, 'Resource protected by organization SSO')).toContain(
      'organization SSO',
    );
  });

  it('distinguishes invalid tokens and rate limits', () => {
    expect(providerErrorMessage('github', 401)).toContain('rejected the access token');
    expect(providerErrorMessage('github', 403, 'API rate limit exceeded', '0')).toContain(
      'rate limit reached',
    );
  });
});
