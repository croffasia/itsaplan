import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type ServerInput, type ServerPatchInput } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useServerOverviewQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.serverOverview(projectKey),
    queryFn: () => api.getServerOverview(projectKey),
    enabled: projectKey.length > 0,
  });
}

export function useServersQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.servers(projectKey),
    queryFn: () => api.listServers(projectKey),
    enabled: projectKey.length > 0,
  });
}

export function useLinkableCustomersQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.serverCustomers(projectKey),
    queryFn: () => api.listLinkableCustomers(projectKey),
    enabled: projectKey.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useServerSessionsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.serverSessions(projectKey),
    queryFn: () => api.listServerSessions(projectKey),
    enabled: projectKey.length > 0,
  });
}

// The listing and the counters each open a short-lived SSH connection, so they
// are not refetched on every window focus.
export function useServerFilesQuery(serverId: number, remotePath: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.serverFiles(serverId, remotePath),
    queryFn: () => api.listServerFiles(serverId, remotePath),
    enabled,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

// Only runs when the operator asks for it: a search walks the tree on the remote
// machine, so it is not fired on every keystroke.
export function useServerFileSearchQuery(serverId: number, remotePath: string, query: string) {
  return useQuery({
    queryKey: qk.serverFileSearch(serverId, remotePath, query),
    queryFn: () => api.searchServerFiles(serverId, remotePath, query),
    enabled: query.trim().length >= 2,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 60_000,
  });
}

export function useServerMetricsQuery(serverId: number, enabled: boolean) {
  return useQuery({
    queryKey: qk.serverMetrics(serverId),
    queryFn: () => api.getServerMetrics(serverId),
    enabled,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 15_000,
  });
}

function useInvalidateServers(projectKey: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.servers(projectKey) });
    void queryClient.invalidateQueries({ queryKey: qk.serverOverview(projectKey) });
    void queryClient.invalidateQueries({ queryKey: qk.serverSessions(projectKey) });
  };
}

export function useCreateServer(projectKey: string) {
  const invalidate = useInvalidateServers(projectKey);
  return useMutation({
    mutationFn: (input: ServerInput) => api.createServer(projectKey, input),
    onSuccess: (created) => {
      invalidate();
      toast.success(`${created.label} added`);
    },
  });
}

export function useUpdateServer(projectKey: string) {
  const invalidate = useInvalidateServers(projectKey);
  return useMutation({
    mutationFn: (input: { serverId: number; patch: ServerPatchInput }) =>
      api.updateServer(input.serverId, input.patch),
    onSuccess: invalidate,
  });
}

export function useDeleteServer(projectKey: string) {
  const invalidate = useInvalidateServers(projectKey);
  return useMutation({
    mutationFn: (serverId: number) => api.deleteServer(serverId),
    onSuccess: () => {
      invalidate();
      toast.success('Server removed');
    },
  });
}

export function useRepinHostKey(projectKey: string) {
  const invalidate = useInvalidateServers(projectKey);
  return useMutation({
    mutationFn: (serverId: number) => api.repinServerHostKey(serverId),
    onSuccess: () => {
      invalidate();
      toast.success('Host key forgotten. The next connection pins the current one.');
    },
  });
}
