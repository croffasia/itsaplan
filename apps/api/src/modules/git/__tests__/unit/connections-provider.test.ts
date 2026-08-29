import { describe, expect, it } from 'bun:test';
import { githubRepository, gitlabRepository } from '../../connections-provider';

describe('Git provider repository responses', () => {
  it('accepts a GitHub repository only when webhooks can be managed', () => {
    expect(
      githubRepository({
        id: 42,
        full_name: 'sekta/app',
        html_url: 'https://github.com/sekta/app',
        private: true,
        permissions: { admin: true },
      }),
    ).toEqual({
      externalId: '42',
      fullName: 'sekta/app',
      webUrl: 'https://github.com/sekta/app',
      private: true,
    });
    expect(
      githubRepository({
        id: 42,
        full_name: 'sekta/app',
        html_url: 'https://github.com/sekta/app',
        permissions: { admin: false },
      }),
    ).toBeNull();
  });

  it('normalizes a GitLab project', () => {
    expect(
      gitlabRepository({
        id: 81,
        path_with_namespace: 'sekta/api',
        web_url: 'https://gitlab.com/sekta/api',
        visibility: 'private',
      }),
    ).toEqual({
      externalId: '81',
      fullName: 'sekta/api',
      webUrl: 'https://gitlab.com/sekta/api',
      private: true,
    });
    expect(
      gitlabRepository({
        id: 82,
        path_with_namespace: 'sekta/internal',
        web_url: 'https://gitlab.com/sekta/internal',
        visibility: 'internal',
      }),
    ).toMatchObject({ private: true });
  });

  it('rejects malformed provider responses', () => {
    expect(githubRepository({ id: 1, permissions: { admin: true } })).toBeNull();
    expect(gitlabRepository({ id: 1, path_with_namespace: 'sekta/api' })).toBeNull();
    expect(
      gitlabRepository({
        id: 1,
        path_with_namespace: 'sekta/api',
        web_url: 'javascript:alert(1)',
      }),
    ).toBeNull();
  });
});
