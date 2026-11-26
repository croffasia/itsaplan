import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  listTeamGitConnectionRepositories,
  listTeamGitConnectionSyncedRepositories,
} from '@/lib/api/endpoints/git';
import {
  listGitAccountRepositories,
  listGitAccountSyncedRepositories,
} from '@/lib/api/endpoints/gitAccounts';
import { qk } from '@/services/queryKeys';
import { teamConnectionsKey } from '@/services/gitConnections.service';

// The repositories behind a token: a team's connection on the team Git page, or the user's
// own account on the Accounts page. Keyed under the list each one belongs to, so a change
// to that list reads them again.
export type GitRepositorySource = { teamId: number; connectionId: number } | { accountId: number };

function sourceKey(source: GitRepositorySource) {
  return 'teamId' in source
    ? [...teamConnectionsKey(source.teamId), source.connectionId]
    : [...qk.gitAccounts, source.accountId];
}

// Read from the instance, without asking the host.
export function useGitSyncedRepositoriesQuery(source: GitRepositorySource) {
  return useQuery({
    queryKey: [...sourceKey(source), 'syncedRepositories'],
    queryFn: () =>
      'teamId' in source
        ? listTeamGitConnectionSyncedRepositories(source.teamId, source.connectionId)
        : listGitAccountSyncedRepositories(source.accountId),
  });
}

export function useGitReachableRepositoriesQuery(source: GitRepositorySource, search: string) {
  return useInfiniteQuery({
    queryKey: [...sourceKey(source), 'repositories', search],
    queryFn: ({ pageParam }) => {
      const params = { page: pageParam, search };
      return 'teamId' in source
        ? listTeamGitConnectionRepositories(source.teamId, source.connectionId, params)
        : listGitAccountRepositories(source.accountId, params);
    },
    initialPageParam: 1,
    getNextPageParam: (page) => page.nextPage ?? undefined,
    // Each read asks the host, and a token it refused stays refused.
    retry: false,
  });
}
