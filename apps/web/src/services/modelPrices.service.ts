import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteModelPrice,
  listModelPriceCatalog,
  listUsedModelPrices,
  setModelPrice,
  type ModelPriceInput,
} from '@/lib/api/endpoints/modelPrices';
import type { PageParams } from '@/lib/api/core/paging';
import { qk } from '@/services/queryKeys';

export function useUsedModelPricesQuery(workspaceId: number) {
  return useQuery({
    queryKey: qk.usedModelPrices(workspaceId),
    queryFn: () => listUsedModelPrices(workspaceId),
  });
}

export function useModelPriceCatalogQuery(
  workspaceId: number,
  params: PageParams,
  search: string | undefined,
) {
  return useQuery({
    queryKey: qk.modelPriceCatalog(workspaceId, { ...params, search }),
    queryFn: () => listModelPriceCatalog(workspaceId, params, search),
    placeholderData: keepPreviousData,
  });
}

// A price changes the cost of every call of its model, past ones too, so the dashboards
// are read again along with the lists.
function useRefreshPrices(workspaceId: number) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.modelPrices(workspaceId) }),
      qc.invalidateQueries({ queryKey: ['agentAnalytics'] }),
      qc.invalidateQueries({ queryKey: ['workspaceAgentAnalytics'] }),
    ]);
}

export function useSetModelPrice(workspaceId: number) {
  const refresh = useRefreshPrices(workspaceId);
  return useMutation({
    mutationFn: (input: ModelPriceInput) => setModelPrice(workspaceId, input),
    onSuccess: refresh,
  });
}

export function useDeleteModelPrice(workspaceId: number) {
  const refresh = useRefreshPrices(workspaceId);
  return useMutation({
    mutationFn: (priceId: number) => deleteModelPrice(workspaceId, priceId),
    onSuccess: refresh,
  });
}
