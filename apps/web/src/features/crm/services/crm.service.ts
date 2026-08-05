import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type CrmCustomerInput } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useCrmCustomersQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.crmCustomers(projectKey),
    queryFn: () => api.listCrmCustomers(projectKey),
    enabled: projectKey.length > 0,
  });
}

export function useCrmCustomerQuery(customerId: string) {
  return useQuery({
    queryKey: qk.crmCustomer(customerId),
    queryFn: () => api.getCrmCustomer(customerId),
    enabled: customerId.length > 0,
  });
}

export function useCreateCrmCustomer(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrmCustomerInput) => api.createCrmCustomer(projectKey, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.crmCustomers(projectKey) });
      toast.success('Customer created');
    },
  });
}

export function useUpdateCrmCustomer(projectKey: string, customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<CrmCustomerInput>) => api.updateCrmCustomer(customerId, patch),
    onSuccess: (customer) => {
      queryClient.setQueryData(qk.crmCustomer(customerId), customer);
      void queryClient.invalidateQueries({ queryKey: qk.crmCustomers(projectKey) });
      toast.success('Customer updated');
    },
  });
}

export function useDeleteCrmCustomer(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (customerId: string) => api.deleteCrmCustomer(customerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.crmCustomers(projectKey) });
      toast.success('Customer deleted');
    },
  });
}
