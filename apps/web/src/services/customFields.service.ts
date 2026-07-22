import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useCustomFieldsQuery(projectKey: string | null, typeId?: number | null) {
  return useQuery({
    queryKey: qk.customFields(projectKey ?? '', typeId),
    queryFn: () => api.listCustomFields(projectKey!, typeId ?? undefined),
    enabled: projectKey != null,
  });
}
