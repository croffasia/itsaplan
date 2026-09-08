import { request } from '@/lib/api/core/client';

// Per-project repository integration settings, shared by every provider.
// webhookId is the path segment of the payload URL registered on the repository;
// secret authenticates its deliveries and is null for members who may read but not
// edit integrations. onMergeColumnId is where an issue closed by a merged pull
// request moves (null = the first completed state); onOpenColumnId is where an
// issue moves when a linked pull request is opened (null = no action).
export interface GitSettings {
  enabled: boolean;
  webhookId: string;
  secret: string | null;
  onMergeColumnId: number | null;
  onOpenColumnId: number | null;
  linkbackComments: boolean;
  repositories: GitRepository[];
}

// One repository that has delivered to the project, with the host it came from
// and when its last delivery arrived.
export interface GitRepository {
  repo: string;
  provider: string;
  lastEventAt: string;
}

export type GitConnectionProvider = 'github' | 'gitlab' | 'gitea' | 'forgejo' | 'bitbucket';

export interface GitManagedRepository {
  id: number;
  externalId: string;
  fullName: string;
  webUrl: string;
  status: 'connected' | 'error';
  lastError: string | null;
}

export interface AvailableGitRepositoryPage {
  repositories: AvailableGitRepository[];
  nextPage: number | null;
}

export interface GitProviderConnection {
  id: number;
  provider: GitConnectionProvider;
  baseUrl: string;
  accountLogin: string;
  repositories: GitManagedRepository[];
  createdAt: string;
  updatedAt: string;
}

export interface AvailableGitRepository {
  externalId: string;
  fullName: string;
  webUrl: string;
  private: boolean;
  managedRepositoryId: number | null;
}

export type GitProvider = 'github' | 'gitlab' | 'gitea' | 'forgejo' | 'bitbucket';

export type PullRequestState = 'open' | 'merged' | 'closed';

export type PipelineStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped';

export interface DevelopmentCheck {
  id: number;
  name: string;
  status: PipelineStatus;
  url: string | null;
  updatedAt: string;
}

export interface DevelopmentLink {
  id: number;
  provider: GitProvider;
  repository: string;
  kind: 'pull_request' | 'branch';
  number: number | null;
  title: string;
  url: string | null;
  state: PullRequestState;
  draft: boolean;
  sourceBranch: string | null;
  targetBranch: string;
  headSha: string | null;
  pipelineStatus: PipelineStatus | null;
  pipelineUrl: string | null;
  checkStatus: PipelineStatus | null;
  checks: DevelopmentCheck[];
  updatedAt: string;
}

export interface DevelopmentRepository {
  id: number;
  provider: 'github' | 'gitlab';
  fullName: string;
  webUrl: string;
}

export interface LinkablePullRequest {
  number: number;
  title: string;
  url: string | null;
  state: PullRequestState;
  draft: boolean;
  sourceBranch: string | null;
  targetBranch: string;
  headSha: string | null;
  updatedAt: string;
  linked: boolean;
}

export interface LinkablePullRequestPage {
  pullRequests: LinkablePullRequest[];
  nextPage: number | null;
}

export interface DevelopmentBranchPage {
  branches: string[];
  defaultBranch: string | null;
  nextPage: number | null;
}

export interface CreateIssuePullRequestInput {
  repositoryId: number;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  draft: boolean;
}

// The repository integration (integrations: read to view, edit to change).
export const getGitSettings = (projectKey: string) =>
  request<GitSettings>(`/projects/${projectKey}/settings/git`);

export const updateGitSettings = (
  projectKey: string,
  patch: {
    enabled?: boolean;
    onMergeColumnId?: number | null;
    onOpenColumnId?: number | null;
    linkbackComments?: boolean;
  },
) =>
  request<GitSettings>(`/projects/${projectKey}/settings/git`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const regenerateGitSecret = (projectKey: string) =>
  request<GitSettings>(`/projects/${projectKey}/settings/git/secret`, {
    method: 'POST',
  });

export const listGitProviderConnections = (projectKey: string) =>
  request<GitProviderConnection[]>(`/projects/${projectKey}/settings/git/connections`);

export const connectGitProvider = (
  projectKey: string,
  input: { provider: GitConnectionProvider; baseUrl?: string; token: string },
) =>
  request<GitProviderConnection>(`/projects/${projectKey}/settings/git/connections`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const disconnectGitProvider = (projectKey: string, connectionId: number) =>
  request<void>(`/projects/${projectKey}/settings/git/connections/${connectionId}`, {
    method: 'DELETE',
  });

export const listAvailableGitRepositories = (
  projectKey: string,
  connectionId: number,
  params: { page?: number; search?: string },
) => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.search) query.set('search', params.search);
  return request<AvailableGitRepositoryPage>(
    `/projects/${projectKey}/settings/git/connections/${connectionId}/repositories?${query}`,
  );
};

export const connectGitRepositories = (
  projectKey: string,
  connectionId: number,
  externalIds: string[],
) =>
  request<GitProviderConnection>(
    `/projects/${projectKey}/settings/git/connections/${connectionId}/repositories`,
    { method: 'POST', body: JSON.stringify({ externalIds }) },
  );

export const disconnectGitRepository = (
  projectKey: string,
  connectionId: number,
  repositoryId: number,
) =>
  request<void>(
    `/projects/${projectKey}/settings/git/connections/${connectionId}/repositories/${repositoryId}`,
    { method: 'DELETE' },
  );

export const listIssueDevelopmentRepositories = (issueId: number) =>
  request<DevelopmentRepository[]>(`/issues/${issueId}/development/repositories`);

export const listLinkablePullRequests = (
  issueId: number,
  repositoryId: number,
  input: { state: 'open' | 'all'; page: number },
) =>
  request<LinkablePullRequestPage>(
    `/issues/${issueId}/development/repositories/${repositoryId}/pull-requests?${new URLSearchParams(
      { state: input.state, page: String(input.page) },
    )}`,
  );

export const listDevelopmentBranches = (issueId: number, repositoryId: number, page: number) =>
  request<DevelopmentBranchPage>(
    `/issues/${issueId}/development/repositories/${repositoryId}/branches?page=${page}`,
  );

export const linkIssueDevelopment = (
  issueId: number,
  input: { repositoryId: number; number: number },
) =>
  request<DevelopmentLink>(`/issues/${issueId}/development`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const removeIssueDevelopmentLink = (issueId: number, linkId: number) =>
  request<void>(`/issues/${issueId}/development/${linkId}`, { method: 'DELETE' });

export const createIssuePullRequest = (issueId: number, input: CreateIssuePullRequestInput) =>
  request<DevelopmentLink>(`/issues/${issueId}/development/pull-requests`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
