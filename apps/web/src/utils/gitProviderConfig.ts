import type { GitConnectionProvider } from '@/lib/api/endpoints/git';

// `tokenPath` is where the host issues tokens, under the address of the instance. Bitbucket
// issues them in each workspace's settings, so it has none. `placeholder` is an example
// address for a host that has no default one.
export const GIT_PROVIDER_CONFIG: Record<
  GitConnectionProvider,
  { label: string; defaultBaseUrl: string; tokenPath: string | null; placeholder?: string }
> = {
  github: {
    label: 'GitHub',
    defaultBaseUrl: 'https://github.com',
    tokenPath: '/settings/personal-access-tokens/new',
  },
  gitlab: {
    label: 'GitLab',
    defaultBaseUrl: 'https://gitlab.com',
    tokenPath: '/-/user_settings/personal_access_tokens',
  },
  gitea: {
    label: 'Gitea',
    defaultBaseUrl: '',
    tokenPath: '/user/settings/applications',
    placeholder: 'https://gitea.example.com',
  },
  forgejo: {
    label: 'Forgejo',
    defaultBaseUrl: '',
    tokenPath: '/user/settings/applications',
    placeholder: 'https://codeberg.org',
  },
  bitbucket: { label: 'Bitbucket', defaultBaseUrl: 'https://bitbucket.org', tokenPath: null },
};

export const GIT_CONNECTION_PROVIDERS = Object.keys(GIT_PROVIDER_CONFIG) as GitConnectionProvider[];

// The page that creates a token on the host at `baseUrl`, once the address is a URL.
export function gitTokenUrl(provider: GitConnectionProvider, baseUrl: string): string | null {
  const { tokenPath } = GIT_PROVIDER_CONFIG[provider];
  if (!tokenPath || !/^https?:\/\/[^/]/.test(baseUrl)) return null;
  return baseUrl.replace(/\/+$/, '') + tokenPath;
}
