import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type NewCredentialInput, type CredentialPatch } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useCredentialsQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.integrationCredentials(projectKey ?? ''),
    queryFn: () => api.listCredentials(projectKey!),
    enabled: projectKey != null,
  });
}

// The integrations the instance offers. Changes only on deploy, so it is cached
// for the session.
export function useIntegrationCatalogQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.integrationCatalog(projectKey ?? ''),
    queryFn: () => api.listIntegrationCatalog(projectKey!),
    enabled: projectKey != null,
    staleTime: Infinity,
  });
}

// Models an LLM provider offers (from the models.dev registry). Fetched only when a
// provider is chosen; cached for the session.
export function useIntegrationModelsQuery(projectKey: string | null, provider: string | null) {
  return useQuery({
    queryKey: qk.integrationModels(projectKey ?? '', provider ?? ''),
    queryFn: () => api.listIntegrationModels(projectKey!, provider!),
    enabled: projectKey != null && provider != null && provider.length > 0,
    staleTime: Infinity,
  });
}

export function useCreateCredential(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCredentialInput) => api.createCredential(projectKey!, input),
    onSuccess: () => {
      if (projectKey)
        void qc.invalidateQueries({ queryKey: qk.integrationCredentials(projectKey) });
    },
  });
}

export function useUpdateCredential(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: CredentialPatch }) =>
      api.updateCredential(projectKey!, id, patch),
    onSuccess: () => {
      if (projectKey)
        void qc.invalidateQueries({ queryKey: qk.integrationCredentials(projectKey) });
    },
  });
}

export function useDeleteCredential(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteCredential(projectKey!, id),
    onSuccess: () => {
      if (projectKey)
        void qc.invalidateQueries({ queryKey: qk.integrationCredentials(projectKey) });
    },
  });
}
