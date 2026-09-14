import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useSocialDashboardQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.socialDashboard(projectKey),
    queryFn: () => api.getSocialDashboard(projectKey),
    enabled: projectKey.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
