import { describe, expect, it } from 'bun:test';
import {
  bitbucketRepository,
  giteaRepository,
  githubRepository,
  gitlabRepository,
} from '../../connections-provider';

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

  it('normalizes Gitea and Forgejo repositories with admin access', () => {
    expect(
      giteaRepository({
        id: 12,
        full_name: 'sekta/infra',
        html_url: 'https://git.example.com/sekta/infra',
        private: false,
        permissions: { admin: true },
      }),
    ).toEqual({
      externalId: '12',
      fullName: 'sekta/infra',
      webUrl: 'https://git.example.com/sekta/infra',
      private: false,
    });
  });

  it('normalizes a Bitbucket Cloud repository', () => {
    expect(
      bitbucketRepository({
        uuid: '{repo-uuid}',
        full_name: 'sekta/mobile',
        links: { html: { href: 'https://bitbucket.org/sekta/mobile' } },
        is_private: true,
      }),
    ).toEqual({
      externalId: 'sekta/mobile',
      fullName: 'sekta/mobile',
      webUrl: 'https://bitbucket.org/sekta/mobile',
      private: true,
    });
    expect(bitbucketRepository({ full_name: 'sekta/fallback' })).toMatchObject({
      webUrl: 'https://bitbucket.org/sekta/fallback',
      private: true,
    });
  });

  it('rejects malformed provider responses', () => {
    expect(githubRepository({ id: 1, permissions: { admin: true } })).toBeNull();
    expect(gitlabRepository({ id: 1, path_with_namespace: 'sekta/api' })).toBeNull();
    expect(bitbucketRepository({})).toBeNull();
    expect(
      gitlabRepository({
        id: 1,
        path_with_namespace: 'sekta/api',
        web_url: 'javascript:alert(1)',
      }),
    ).toBeNull();
  });
});
