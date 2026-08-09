import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type FinanceTransactionInput } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useFinanceTransactionsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.financeTransactions(projectKey),
    queryFn: () => api.listFinanceTransactions(projectKey),
    enabled: projectKey.length > 0,
  });
}

export function useCreateFinanceTransaction(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FinanceTransactionInput) => api.createFinanceTransaction(projectKey, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.financeTransactions(projectKey),
      });
      toast.success('Transaction added');
    },
  });
}

export function useUpdateFinanceTransaction(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FinanceTransactionInput }) =>
      api.updateFinanceTransaction(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.financeTransactions(projectKey),
      });
      toast.success('Transaction updated');
    },
  });
}

export function useDeleteFinanceTransaction(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFinanceTransaction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.financeTransactions(projectKey),
      });
      toast.success('Transaction deleted');
    },
  });
}
