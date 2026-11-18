import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  connectGitProvider,
  disconnectGitProvider,
  listTeamGitProviderConnections,
} from '@/lib/api/endpoints/git';

const teamConnectionsKey = (teamId: number) => ['teamGitConnections', teamId] as const;

// Pass null to skip the read, for a member who may not list the connections.
export function useTeamGitProviderConnectionsQuery(teamId: number | null) {
  return useQuery({
    queryKey: teamConnectionsKey(teamId ?? 0),
    queryFn: () => listTeamGitProviderConnections(teamId!),
    enabled: teamId !== null,
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
