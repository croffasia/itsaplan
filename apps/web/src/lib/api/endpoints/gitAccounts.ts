import { request } from '@/lib/api/core/client';
import type {
  GitConnectionProvider,
  ReachableGitRepository,
  ReachableGitRepositoryPage,
} from '@/lib/api/endpoints/git';

// The session user's own accounts on repository hosts. A comment they write on an issue
// synced two ways goes to the repository issue under the account on its host.

export type GitAccountProvider = Exclude<GitConnectionProvider, 'bitbucket'>;

export interface GitAccountInput {
  provider: GitAccountProvider;
  baseUrl: string;
  token: string;
}

export interface GitAccount {
  id: number;
  provider: GitAccountProvider;
  baseUrl: string;
  accountLogin: string;
  createdAt: string;
}

// The account a token signs in as. Nothing is stored.
export interface GitAccountCheck {
  provider: GitAccountProvider;
  baseUrl: string;
  accountLogin: string;
  accountName: string | null;
  avatarUrl: string | null;
}

export const listGitAccounts = () => request<GitAccount[]>('/account/git-accounts');

export const checkGitAccount = (input: GitAccountInput) =>
  request<GitAccountCheck>('/account/git-accounts/check', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const connectGitAccount = (input: GitAccountInput) =>
  request<GitAccount>('/account/git-accounts', { method: 'POST', body: JSON.stringify(input) });

// The repositories on the account's host that the user's projects sync with.
export const listGitAccountSyncedRepositories = (id: number) =>
  request<ReachableGitRepository[]>(`/account/git-accounts/${id}/synced-repositories`);

// Every repository the account's token reaches.
export const listGitAccountRepositories = (
  id: number,
  params: { page: number; search: string },
) => {
  const query = new URLSearchParams({ page: String(params.page) });
  if (params.search) query.set('search', params.search);
  return request<ReachableGitRepositoryPage>(`/account/git-accounts/${id}/repositories?${query}`);
};

export const disconnectGitAccount = (id: number) =>
  request<void>(`/account/git-accounts/${id}`, { method: 'DELETE' });
