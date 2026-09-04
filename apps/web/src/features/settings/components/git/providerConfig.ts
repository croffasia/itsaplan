import type { GitConnectionProvider } from '@/lib/api';

export const GIT_PROVIDER_CONFIG: Record<
  GitConnectionProvider,
  { label: string; defaultBaseUrl: string }
> = {
  github: { label: 'GitHub', defaultBaseUrl: 'https://github.com' },
  gitlab: { label: 'GitLab', defaultBaseUrl: 'https://gitlab.com' },
  gitea: { label: 'Gitea', defaultBaseUrl: '' },
  forgejo: { label: 'Forgejo', defaultBaseUrl: '' },
  bitbucket: { label: 'Bitbucket', defaultBaseUrl: 'https://bitbucket.org' },
};

export const GIT_CONNECTION_PROVIDERS = Object.keys(GIT_PROVIDER_CONFIG) as GitConnectionProvider[];
