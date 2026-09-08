import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listWebhooks,
  listWebhookDeliveries,
  createWebhook,
  updateWebhook,
  deleteWebhook,
} from '@/lib/api/endpoints/webhooks';
import { qk } from '@/services/queryKeys';

export function useWebhooksQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.webhooks(projectKey ?? ''),
    queryFn: () => listWebhooks(projectKey!),
    enabled: projectKey != null,
  });
}

// A webhook's deliveries for the history sidebar, paginated 25 at a time. Only
// fetched when webhookId is set, so the query runs when the sidebar opens.
export function useWebhookDeliveries(webhookId: number | null) {
  return useInfiniteQuery({
    queryKey: qk.webhookDeliveries(webhookId ?? 0),
    queryFn: ({ pageParam }) => listWebhookDeliveries(webhookId!, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: webhookId != null,
  });
}

export function useCreateWebhook(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input }: { input: Parameters<typeof createWebhook>[1] }) =>
      createWebhook(projectKey!, input),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.webhooks(projectKey) });
    },
  });
}

export function useUpdateWebhook(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Parameters<typeof updateWebhook>[1] }) =>
      updateWebhook(id, input),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.webhooks(projectKey) });
    },
  });
}

export function useDeleteWebhook(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteWebhook(id),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.webhooks(projectKey) });
    },
  });
}
