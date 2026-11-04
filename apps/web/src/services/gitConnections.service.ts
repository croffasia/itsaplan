import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  connectGithubApp,
  connectGitProvider,
  disconnectGitProvider,
  listTeamGitProviderConnections,
} from '@/lib/api/endpoints/git';

const teamConnectionsKey = (teamId: number) => ['teamGitConnections', teamId] as const;

export function useTeamGitProviderConnectionsQuery(teamId: number) {
  return useQuery({
    queryKey: teamConnectionsKey(teamId),
    queryFn: () => listTeamGitProviderConnections(teamId),
  });
}

export function useConnectGitProvider(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof connectGitProvider>[1]) =>
      connectGitProvider(teamId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamConnectionsKey(teamId) });
      qc.invalidateQueries({ queryKey: ['gitConnections'] });
    },
  });
}

export function useConnectGithubApp(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof connectGithubApp>[1]) => connectGithubApp(teamId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamConnectionsKey(teamId) });
      qc.invalidateQueries({ queryKey: ['gitConnections'] });
    },
  });
}

export function useDisconnectGitProvider(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: number) => disconnectGitProvider(teamId, connectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamConnectionsKey(teamId) });
      qc.invalidateQueries({ queryKey: ['gitConnections'] });
    },
  });
}
